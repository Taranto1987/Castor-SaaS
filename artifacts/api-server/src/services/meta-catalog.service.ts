import { db } from "@workspace/db";
import {
  metaCatalogoConfigTable,
  metaProdutosTable,
  metaSyncJobsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { encryptToken, isEncrypted } from "../lib/meta-crypto";

// ── Token helpers (encrypt on save, never return plaintext) ────────────────────

export async function saveConfig(
  lojaId: number,
  catalogId: string,
  feedId: string | null,
  accessToken: string,
): Promise<void> {
  const stored = isEncrypted(accessToken) ? accessToken : encryptToken(accessToken);

  const [existing] = await db
    .select({ id: metaCatalogoConfigTable.id })
    .from(metaCatalogoConfigTable)
    .where(eq(metaCatalogoConfigTable.lojaId, lojaId));

  if (existing) {
    await db
      .update(metaCatalogoConfigTable)
      .set({ catalogId, feedId: feedId ?? null, accessToken: stored, atualizadoEm: new Date() })
      .where(eq(metaCatalogoConfigTable.id, existing.id));
  } else {
    await db.insert(metaCatalogoConfigTable).values({
      lojaId,
      catalogId,
      feedId: feedId ?? null,
      accessToken: stored,
    });
  }
}

// ── Job queue ───────────────────────────────────────────────────────────────────

/**
 * Idempotently enqueue sync jobs for the given loja.
 * - If no produtoIds given: enqueue all active mappings.
 * - If a job already exists for a product and is 'processing', it is left alone.
 * - Otherwise the existing row is reset to 'pending' (natural dedup).
 */
export async function enqueueMetaSync(
  lojaId: number,
  produtoIds?: number[],
  prioridade = 0,
): Promise<{ enqueued: number }> {
  const where = produtoIds?.length
    ? and(
        eq(metaProdutosTable.lojaId, lojaId),
        eq(metaProdutosTable.ativo, true),
        inArray(metaProdutosTable.produtoId, produtoIds),
      )
    : and(eq(metaProdutosTable.lojaId, lojaId), eq(metaProdutosTable.ativo, true));

  const mappings = await db
    .select({ produtoId: metaProdutosTable.produtoId, metaProductId: metaProdutosTable.metaProductId })
    .from(metaProdutosTable)
    .where(where);

  if (mappings.length === 0) return { enqueued: 0 };

  for (const m of mappings) {
    // Upsert: insert new job or reset existing (except processing) back to pending
    await db.execute(sql`
      INSERT INTO meta_sync_jobs (loja_id, produto_id, meta_product_id, prioridade, status, scheduled_at, created_at)
      VALUES (${lojaId}, ${m.produtoId}, ${m.metaProductId}, ${prioridade}, 'pending', NOW(), NOW())
      ON CONFLICT (produto_id, loja_id) DO UPDATE SET
        status        = CASE WHEN meta_sync_jobs.status = 'processing' THEN 'processing' ELSE 'pending' END,
        meta_product_id = EXCLUDED.meta_product_id,
        prioridade    = GREATEST(meta_sync_jobs.prioridade, EXCLUDED.prioridade),
        scheduled_at  = CASE WHEN meta_sync_jobs.status = 'processing' THEN meta_sync_jobs.scheduled_at ELSE NOW() END,
        error         = CASE WHEN meta_sync_jobs.status = 'processing' THEN meta_sync_jobs.error ELSE NULL END
    `);
  }

  console.log(JSON.stringify({ event: "meta_sync_enqueued", lojaId, enqueued: mappings.length, prioridade }));
  return { enqueued: mappings.length };
}

/**
 * Backward-compatible entry point used by the crawler trigger and /sincronizar route.
 * Now enqueues instead of calling the Graph API directly — returns immediately.
 */
export async function sincronizarProdutos(lojaId: number): Promise<{ enqueued: number }> {
  const [config] = await db
    .select({ id: metaCatalogoConfigTable.id })
    .from(metaCatalogoConfigTable)
    .where(and(eq(metaCatalogoConfigTable.lojaId, lojaId), eq(metaCatalogoConfigTable.ativo, true)))
    .limit(1);

  if (!config) {
    throw new Error(`Meta Catalog config não encontrada ou inativa para loja ${lojaId}`);
  }

  return enqueueMetaSync(lojaId);
}

/**
 * Mark dead jobs for a loja as pending again (manual retry from dashboard).
 */
export async function retryDeadJobs(lojaId: number): Promise<{ retried: number }> {
  const raw = await db.execute(sql`
    UPDATE meta_sync_jobs
    SET status = 'pending', retry_count = 0, error = NULL, scheduled_at = NOW()
    WHERE loja_id = ${lojaId} AND status = 'dead'
    RETURNING id
  `);
  const rows = (Array.isArray(raw) ? raw : (raw as { rows?: unknown[] }).rows ?? []) as unknown[];
  console.log(JSON.stringify({ event: "meta_dead_jobs_retried", lojaId, retried: rows.length }));
  return { retried: rows.length };
}
