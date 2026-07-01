import { createHash, randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import {
  metaCatalogoConfigTable,
  metaProdutosTable,
  metaSyncJobsTable,
  metaSyncAuditTable,
  produtosTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { decryptToken } from "../lib/meta-crypto";
import { canCall, onSuccess, onFailure } from "../lib/meta-circuit-breaker";
import { tryConsume } from "../lib/meta-rate-limiter";
import { logEvent } from "../lib/log-event";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";
const WORKER_INTERVAL_MS = 30_000;
const BATCH_SIZE = 50;
const MAX_DURATION_SAMPLES = 1000;

// ── In-memory Prometheus counters (never resets between worker ticks) ──────────

const m = {
  jobsTotal: 0,
  jobsSuccess: 0,
  jobsFailed: 0,
  jobsDead: 0,
  jobsSkipped: 0,
  circuitOpen: 0,
  rateLimited: 0,
  durations: [] as number[],
};

function recordDuration(ms: number): void {
  m.durations.push(ms);
  if (m.durations.length > MAX_DURATION_SAMPLES) m.durations.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)] ?? 0;
}

export function getPrometheusMetrics(): string {
  const sorted = [...m.durations].sort((a, b) => a - b);
  const avg = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
  return [
    `# HELP meta_sync_jobs_total Total Meta Catalog sync job attempts`,
    `# TYPE meta_sync_jobs_total counter`,
    `meta_sync_jobs_total ${m.jobsTotal}`,
    `# HELP meta_sync_success_total Successful Meta Catalog syncs`,
    `# TYPE meta_sync_success_total counter`,
    `meta_sync_success_total ${m.jobsSuccess}`,
    `# HELP meta_sync_failed_total Failed (retryable) Meta Catalog syncs`,
    `# TYPE meta_sync_failed_total counter`,
    `meta_sync_failed_total ${m.jobsFailed}`,
    `# HELP meta_sync_dead_total Dead-lettered Meta Catalog sync jobs`,
    `# TYPE meta_sync_dead_total counter`,
    `meta_sync_dead_total ${m.jobsDead}`,
    `# HELP meta_sync_skipped_total Skipped syncs (no change detected)`,
    `# TYPE meta_sync_skipped_total counter`,
    `meta_sync_skipped_total ${m.jobsSkipped}`,
    `# HELP meta_sync_circuit_open_total Jobs deferred because circuit breaker is OPEN`,
    `# TYPE meta_sync_circuit_open_total counter`,
    `meta_sync_circuit_open_total ${m.circuitOpen}`,
    `# HELP meta_sync_rate_limited_total Jobs deferred due to rate limiting`,
    `# TYPE meta_sync_rate_limited_total counter`,
    `meta_sync_rate_limited_total ${m.rateLimited}`,
    `# HELP meta_sync_duration_avg_ms Average per-batch sync duration in milliseconds`,
    `# TYPE meta_sync_duration_avg_ms gauge`,
    `meta_sync_duration_avg_ms ${avg.toFixed(2)}`,
    `# HELP meta_sync_duration_p50_ms P50 sync duration in milliseconds`,
    `# TYPE meta_sync_duration_p50_ms gauge`,
    `meta_sync_duration_p50_ms ${percentile(sorted, 0.5)}`,
    `# HELP meta_sync_duration_p95_ms P95 sync duration in milliseconds`,
    `# TYPE meta_sync_duration_p95_ms gauge`,
    `meta_sync_duration_p95_ms ${percentile(sorted, 0.95)}`,
    `# HELP meta_sync_duration_p99_ms P99 sync duration in milliseconds`,
    `# TYPE meta_sync_duration_p99_ms gauge`,
    `meta_sync_duration_p99_ms ${percentile(sorted, 0.99)}`,
  ].join("\n");
}

export function getMetricsSummary() {
  return { ...m, durations: undefined };
}

// ── Scheduler lifecycle ────────────────────────────────────────────────────────

let _handle: ReturnType<typeof setInterval> | null = null;

export function iniciarWorkerMetaSync(): void {
  if (_handle) return;
  _handle = setInterval(() => {
    void processarJobs().catch((err) => {
      console.error(JSON.stringify({
        event: "meta_worker_tick_error",
        error: err instanceof Error ? err.message : String(err),
      }));
    });
  }, WORKER_INTERVAL_MS);
  console.log(JSON.stringify({ event: "meta_worker_started", intervalMs: WORKER_INTERVAL_MS }));
}

export function stopWorkerMetaSync(): void {
  if (_handle) {
    clearInterval(_handle);
    _handle = null;
    console.log(JSON.stringify({ event: "meta_worker_stopped" }));
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type ClaimedRow = {
  id: number;
  loja_id: number;
  produto_id: number;
  meta_product_id: string | null;
  retry_count: number;
  max_retries: number;
};

function normalizeRows<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { rows?: T[] };
  return r.rows ?? [];
}

function computeHash(preco: string | null | undefined, disponivel: boolean | null | undefined): string {
  return createHash("sha256")
    .update(`${preco ?? ""}:${disponivel ?? false}`)
    .digest("hex")
    .slice(0, 16);
}

function backoffMs(retryCount: number): number {
  // Exponential backoff: 5s, 10s, 20s, 40s … capped at 5 min
  return Math.min(5_000 * 2 ** retryCount, 300_000);
}

async function writeAudit(params: {
  lojaId: number;
  produtoId: number;
  metaProductId: string;
  precoNovo?: string | null;
  disponivelNovo?: boolean | null;
  resultado: string;
  duracaoMs?: number;
  traceId?: string;
  erro?: string;
  respostaMeta?: string;
}): Promise<void> {
  try {
    await db.insert(metaSyncAuditTable).values({
      lojaId: params.lojaId,
      produtoId: params.produtoId,
      metaProductId: params.metaProductId,
      precoNovo: params.precoNovo ?? null,
      disponivelNovo: params.disponivelNovo ?? null,
      resultado: params.resultado,
      duracaoMs: params.duracaoMs ?? null,
      traceId: params.traceId ?? null,
      erro: params.erro?.slice(0, 1000) ?? null,
      respostaMeta: params.respostaMeta?.slice(0, 500) ?? null,
    });
  } catch (err) {
    console.error(JSON.stringify({
      event: "meta_audit_write_failed",
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

async function markJobFailed(
  job: ClaimedRow,
  errMsg: string,
  traceId: string,
  permanent: boolean,
): Promise<void> {
  const newRetryCount = job.retry_count + 1;
  const dead = permanent || newRetryCount >= job.max_retries;
  const nextStatus = dead ? "dead" : "pending";
  const nextScheduled = dead ? null : new Date(Date.now() + backoffMs(job.retry_count));

  await db
    .update(metaSyncJobsTable)
    .set({
      status: nextStatus,
      retryCount: newRetryCount,
      error: errMsg.slice(0, 1000),
      scheduledAt: nextScheduled ?? undefined,
      traceId,
    })
    .where(eq(metaSyncJobsTable.id, job.id));

  const syncStatus = dead ? "dead" : "error";
  await db
    .update(metaProdutosTable)
    .set({
      syncStatus,
      ultimoErro: errMsg.slice(0, 500),
      tentativas: sql`${metaProdutosTable.tentativas} + 1`,
    })
    .where(
      and(
        eq(metaProdutosTable.produtoId, job.produto_id),
        eq(metaProdutosTable.lojaId, job.loja_id),
      ),
    );

  if (dead) {
    m.jobsDead++;
    console.log(JSON.stringify({
      event: "meta_job_dead",
      lojaId: job.loja_id,
      produtoId: job.produto_id,
      retryCount: newRetryCount,
      traceId,
    }));
  } else {
    m.jobsFailed++;
    console.log(JSON.stringify({
      event: "meta_job_retry",
      lojaId: job.loja_id,
      produtoId: job.produto_id,
      retryCount: newRetryCount,
      nextRetryMs: nextScheduled ? nextScheduled.getTime() - Date.now() : 0,
      traceId,
    }));
  }
}

// ── Core worker tick ───────────────────────────────────────────────────────────

async function processarJobs(): Promise<void> {
  const traceId = randomUUID();

  // Load all active loja configs (access token decrypted only when needed for the API call)
  const configs = await db
    .select({
      lojaId: metaCatalogoConfigTable.lojaId,
      accessToken: metaCatalogoConfigTable.accessToken,
    })
    .from(metaCatalogoConfigTable)
    .where(eq(metaCatalogoConfigTable.ativo, true));

  if (configs.length === 0) return;

  for (const config of configs) {
    const { lojaId } = config;

    // ── Circuit breaker ──────────────────────────────────────────────────────
    if (!canCall(lojaId)) {
      m.circuitOpen++;
      console.log(JSON.stringify({ event: "meta_worker_circuit_open", lojaId, traceId }));
      continue;
    }

    // ── Claim pending jobs with FOR UPDATE SKIP LOCKED ───────────────────────
    const claimedRaw = await db.execute<ClaimedRow>(sql`
      UPDATE meta_sync_jobs SET status = 'processing', trace_id = ${traceId}, processed_at = NOW()
      WHERE id = ANY(
        SELECT id FROM meta_sync_jobs
        WHERE loja_id = ${lojaId}
          AND status = 'pending'
          AND scheduled_at <= NOW()
        ORDER BY prioridade DESC, scheduled_at ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, loja_id, produto_id, meta_product_id, retry_count, max_retries
    `);
    const claimed = normalizeRows<ClaimedRow>(claimedRaw);
    if (claimed.length === 0) continue;

    // ── Rate limiter (one token = one batch call) ─────────────────────────────
    if (!tryConsume(lojaId, 1)) {
      m.rateLimited += claimed.length;
      // Release jobs back to pending
      await db.execute(sql`
        UPDATE meta_sync_jobs SET status = 'pending', trace_id = NULL, processed_at = NULL
        WHERE trace_id = ${traceId} AND loja_id = ${lojaId}
      `);
      console.log(JSON.stringify({ event: "meta_worker_rate_limited", lojaId, traceId, jobs: claimed.length }));
      continue;
    }

    // ── Fetch product data from local DB ──────────────────────────────────────
    const produtoIds = claimed.map((j) => j.produto_id);
    const produtos = await db
      .select({ id: produtosTable.id, precoBase: produtosTable.precoBase, disponivel: produtosTable.disponivel })
      .from(produtosTable)
      .where(and(eq(produtosTable.lojaId, lojaId), inArray(produtosTable.id, produtoIds)));
    const produtoMap = new Map(produtos.map((p) => [p.id, p]));

    // ── Fetch last-synced hashes for change detection ─────────────────────────
    const syncStates = await db
      .select({ produtoId: metaProdutosTable.produtoId, ultimoHash: metaProdutosTable.ultimoHash })
      .from(metaProdutosTable)
      .where(and(eq(metaProdutosTable.lojaId, lojaId), inArray(metaProdutosTable.produtoId, produtoIds)));
    const hashMap = new Map(syncStates.map((r) => [r.produtoId, r.ultimoHash]));

    // ── Build batch payload, skipping unchanged products ──────────────────────
    type BatchItem = {
      job: ClaimedRow;
      metaProductId: string;
      urlBody: string;
      preco: string;
      disponivel: boolean;
      newHash: string;
    };

    const batchItems: BatchItem[] = [];
    const toMarkDone: number[] = []; // jobs to mark done without calling Meta API

    for (const job of claimed) {
      const metaId = job.meta_product_id;
      if (!metaId) {
        await markJobFailed(job, "meta_product_id não configurado", traceId, true);
        m.jobsTotal++;
        await writeAudit({
          lojaId, produtoId: job.produto_id, metaProductId: metaId ?? "", resultado: "error",
          erro: "meta_product_id não configurado", traceId,
        });
        continue;
      }

      const produto = produtoMap.get(job.produto_id);
      if (!produto?.precoBase) {
        await markJobFailed(job, "Produto sem preço base — sincronização impossível", traceId, false);
        m.jobsTotal++;
        await writeAudit({
          lojaId, produtoId: job.produto_id, metaProductId: metaId, resultado: "error",
          erro: "Produto sem preço base", traceId,
        });
        continue;
      }

      const disponivel = produto.disponivel ?? false;
      const newHash = computeHash(produto.precoBase, disponivel);
      const oldHash = hashMap.get(job.produto_id);

      if (oldHash === newHash) {
        toMarkDone.push(job.id);
        m.jobsSkipped++;
        await writeAudit({
          lojaId, produtoId: job.produto_id, metaProductId: metaId,
          precoNovo: produto.precoBase, disponivelNovo: disponivel,
          resultado: "skipped", traceId,
        });
        continue;
      }

      const priceCents = Math.round(parseFloat(produto.precoBase) * 100);
      const urlBody = new URLSearchParams({
        price: `${priceCents} BRL`,
        availability: disponivel ? "in stock" : "out of stock",
      }).toString();

      batchItems.push({ job, metaProductId: metaId, urlBody, preco: produto.precoBase, disponivel, newHash });
    }

    // Mark no-change jobs as done
    if (toMarkDone.length > 0) {
      await db.execute(sql`
        UPDATE meta_sync_jobs SET status = 'done', processed_at = NOW()
        WHERE id = ANY(${sql.raw(`ARRAY[${toMarkDone.join(",")}]::int[]`)})
      `);
    }

    if (batchItems.length === 0) continue;

    // ── Call Meta Graph Batch API ─────────────────────────────────────────────
    // Decrypt access token only now, only in memory — never log, never store
    const plainToken = decryptToken(config.accessToken);
    const batchPayload = batchItems.map((item) => ({
      method: "POST",
      relative_url: item.metaProductId,
      body: item.urlBody,
    }));

    const started = Date.now();
    let batchResults: Array<{ code: number; body: string }> = [];
    let batchFailed = false;
    let batchError = "";

    try {
      const resp = await fetch(GRAPH_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: batchPayload, access_token: plainToken, include_headers: false }),
      });

      const raw = await resp.json() as unknown;
      if (!Array.isArray(raw)) {
        const errStr = JSON.stringify(raw).slice(0, 300);
        throw new Error(`Graph Batch API returned non-array: ${errStr}`);
      }
      batchResults = raw as Array<{ code: number; body: string }>;
    } catch (err) {
      batchFailed = true;
      batchError = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - started;
    recordDuration(durationMs);

    if (batchFailed) {
      onFailure(lojaId);
      for (const item of batchItems) {
        await markJobFailed(item.job, batchError, traceId, false);
        m.jobsTotal++;
        await writeAudit({
          lojaId, produtoId: item.job.produto_id, metaProductId: item.metaProductId,
          resultado: "error", erro: batchError, duracaoMs: durationMs, traceId,
        });
      }
      console.log(JSON.stringify({ event: "meta_batch_error", lojaId, traceId, error: batchError, jobs: batchItems.length }));
      continue;
    }

    // ── Process per-item responses ────────────────────────────────────────────
    let batchSuccess = 0;
    let batchErrors = 0;

    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i]!;
      const result = batchResults[i];
      m.jobsTotal++;

      if (!result) {
        await markJobFailed(item.job, "Batch response missing for this item", traceId, false);
        batchErrors++;
        continue;
      }

      const ok = result.code >= 200 && result.code < 300;
      // 429 = rate limited (transient), 4xx = permanent, 5xx = transient
      const permanent = result.code >= 400 && result.code < 500 && result.code !== 429;

      if (ok) {
        batchSuccess++;
        m.jobsSuccess++;
        onSuccess(lojaId);

        await db
          .update(metaSyncJobsTable)
          .set({ status: "done", processedAt: new Date(), error: null, traceId })
          .where(eq(metaSyncJobsTable.id, item.job.id));

        await db
          .update(metaProdutosTable)
          .set({
            syncStatus: "ok",
            ultimoSyncAt: new Date(),
            ultimoHash: item.newHash,
            ultimoPreco: item.preco,
            ultimoDisponivel: item.disponivel,
            ultimaRespostaMeta: result.body.slice(0, 500),
            ultimoErro: null,
            tentativas: sql`${metaProdutosTable.tentativas} + 1`,
          })
          .where(
            and(
              eq(metaProdutosTable.produtoId, item.job.produto_id),
              eq(metaProdutosTable.lojaId, lojaId),
            ),
          );

        await writeAudit({
          lojaId, produtoId: item.job.produto_id, metaProductId: item.metaProductId,
          precoNovo: item.preco, disponivelNovo: item.disponivel,
          resultado: "ok", duracaoMs: Math.round(durationMs / batchItems.length),
          traceId, respostaMeta: result.body.slice(0, 500),
        });

      } else {
        batchErrors++;
        onFailure(lojaId);

        let errMsg: string;
        try {
          const parsed = JSON.parse(result.body) as { error?: { message?: string } };
          errMsg = parsed.error?.message ?? `HTTP ${result.code}`;
        } catch {
          errMsg = `HTTP ${result.code}`;
        }

        await markJobFailed(item.job, errMsg, traceId, permanent);
        await writeAudit({
          lojaId, produtoId: item.job.produto_id, metaProductId: item.metaProductId,
          resultado: "error", erro: errMsg,
          duracaoMs: Math.round(durationMs / batchItems.length),
          traceId, respostaMeta: result.body.slice(0, 500),
        });
      }
    }

    // ── COCA event emission ───────────────────────────────────────────────────
    await logEvent({
      lojaId,
      entidade: "meta_catalog",
      acao: "batch_sync_completed",
      atorTipo: "sistema",
      payload: {
        traceId,
        sincronizados: batchSuccess,
        erros: batchErrors,
        skipped: m.jobsSkipped,
        total: claimed.length,
        durationMs,
      },
    });

    console.log(JSON.stringify({
      event: "meta_worker_batch_complete",
      lojaId,
      traceId,
      sincronizados: batchSuccess,
      erros: batchErrors,
      skipped: toMarkDone.length,
      total: claimed.length,
      durationMs,
    }));
  }
}
