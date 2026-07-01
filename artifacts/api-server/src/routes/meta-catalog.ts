import { Router, type IRouter } from "express";
import { db, metaCatalogoConfigTable, metaProdutosTable, metaSyncJobsTable, metaSyncAuditTable, lojasTable, produtosTable } from "@workspace/db";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { requireDono, type AuthRequest } from "../middlewares/auth";
import { saveConfig, sincronizarProdutos, enqueueMetaSync, retryDeadJobs } from "../services/meta-catalog.service";
import { getPrometheusMetrics } from "../services/meta-catalog.worker";
import { getAllStates } from "../lib/meta-circuit-breaker";
import { getStatus as getRateLimitStatus } from "../lib/meta-rate-limiter";

const router: IRouter = Router();

// ── CSV helpers ────────────────────────────────────────────────────────────────

function escCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// Map Castor categories to Google product category IDs (best-effort)
const GOOGLE_CATEGORY_MAP: Record<string, string> = {
  colchao: "4" , // Furniture > Mattresses
  travesseiro: "5181", // Bedding > Pillows
  protetor: "5181",
  base: "4",
  cama: "4",
  default: "4",
};

function googleCategory(categoria: string | null | undefined): string {
  if (!categoria) return GOOGLE_CATEGORY_MAP["default"]!;
  const lower = categoria.toLowerCase();
  for (const [k, v] of Object.entries(GOOGLE_CATEGORY_MAP)) {
    if (lower.includes(k)) return v;
  }
  return GOOGLE_CATEGORY_MAP["default"]!;
}

// Returns true if the value looks like a GTIN-8, GTIN-12, or GTIN-13
function looksLikeGtin(sku: string | null | undefined): boolean {
  return !!sku && /^\d{8,14}$/.test(sku.trim());
}

// ── Public: CSV product feed for Meta Commerce Manager ─────────────────────────
// GET /api/meta-catalog/feed/:lojaSlug
router.get("/meta-catalog/feed/:lojaSlug", async (req, res) => {
  try {
    const { lojaSlug } = req.params;

    const [loja] = await db
      .select({ id: lojasTable.id })
      .from(lojasTable)
      .where(and(eq(lojasTable.slug, lojaSlug), eq(lojasTable.ativa, true)));

    if (!loja) { res.status(404).send("Feed not found"); return; }

    const [config] = await db
      .select()
      .from(metaCatalogoConfigTable)
      .where(and(eq(metaCatalogoConfigTable.lojaId, loja.id), eq(metaCatalogoConfigTable.ativo, true)));

    if (!config) { res.status(404).send("Feed not configured"); return; }

    const mappings = await db
      .select({ metaProductId: metaProdutosTable.metaProductId, retailerId: metaProdutosTable.retailerId, produtoId: metaProdutosTable.produtoId })
      .from(metaProdutosTable)
      .where(and(eq(metaProdutosTable.lojaId, loja.id), eq(metaProdutosTable.ativo, true)));

    if (mappings.length === 0) { res.status(404).send("No products mapped"); return; }

    const products = await db
      .select()
      .from(produtosTable)
      .where(and(eq(produtosTable.lojaId, loja.id), eq(produtosTable.disponivel, true)));

    const productMap = new Map(products.map((p) => [p.id, p]));

    const header = "id,title,description,availability,condition,price,sale_price,link,image_link,brand,google_product_category,identifier_exists,gtin";
    const rows: string[] = [header];

    for (const m of mappings) {
      const p = productMap.get(m.produtoId);
      if (!p) continue;

      const retailerId = m.retailerId || String(p.id);
      const title = p.nome;
      const description = p.descricao
        ? p.descricao.replace(/<[^>]*>/g, "").substring(0, 5000)
        : p.nome;
      const availability = p.disponivel ? "in stock" : "out of stock";

      let priceNum = p.precoBase ? parseFloat(p.precoBase) : null;
      if (!priceNum && p.preco) {
        const parsed = p.preco.replace(/[^\d,.]/g, "").replace(",", ".");
        priceNum = parseFloat(parsed) || null;
      }
      const price = priceNum ? `${priceNum.toFixed(2)} BRL` : "";

      // Promotional / outlet price
      const salePrice = p.outletPrice ? `${parseFloat(p.outletPrice).toFixed(2)} BRL` : "";

      const link = p.link || `https://lojacastor.com.br/${p.slug || ""}`;
      const imageLink = p.imagem || "";
      const gcat = googleCategory(p.categoria);
      const gtin = looksLikeGtin(p.sku) ? p.sku! : "";
      const identifierExists = gtin ? "yes" : "no";

      rows.push(
        [
          escCsv(retailerId),
          escCsv(title),
          escCsv(description),
          escCsv(availability),
          escCsv("new"),
          escCsv(price),
          escCsv(salePrice),
          escCsv(link),
          escCsv(imageLink),
          escCsv("Castor"),
          escCsv(gcat),
          escCsv(identifierExists),
          escCsv(gtin),
        ].join(","),
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="meta-feed-${lojaSlug}.csv"`);
    res.setHeader("Cache-Control", "public, max-age=900");
    res.send(rows.join("\n"));
  } catch (err) {
    console.error("[meta-catalog] feed error:", err);
    res.status(500).send("Internal server error");
  }
});

// ── Protected: Management routes (dono only) ───────────────────────────────────

// GET /api/meta-catalog/config
// NOTE: accessToken is NEVER returned — only tokenConfigured boolean
router.get("/meta-catalog/config", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const [config] = await db
      .select({
        id: metaCatalogoConfigTable.id,
        catalogId: metaCatalogoConfigTable.catalogId,
        feedId: metaCatalogoConfigTable.feedId,
        ativo: metaCatalogoConfigTable.ativo,
        criadoEm: metaCatalogoConfigTable.criadoEm,
        atualizadoEm: metaCatalogoConfigTable.atualizadoEm,
        // Deliberately exclude accessToken
        tokenConfigured: sql<boolean>`(access_token IS NOT NULL AND access_token != '')`,
      })
      .from(metaCatalogoConfigTable)
      .where(eq(metaCatalogoConfigTable.lojaId, lojaId));

    res.json(config ?? null);
  } catch (err) {
    console.error("[meta-catalog] config get error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/meta-catalog/config
// Saves config and ALWAYS encrypts the access token before persisting
router.post("/meta-catalog/config", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { catalogId, feedId, accessToken } = req.body as {
      catalogId?: string;
      feedId?: string;
      accessToken?: string;
    };

    if (!catalogId || !accessToken) {
      res.status(400).json({ error: "catalogId e accessToken são obrigatórios" });
      return;
    }

    await saveConfig(lojaId, catalogId, feedId ?? null, accessToken);
    res.json({ ok: true });
  } catch (err) {
    console.error("[meta-catalog] config save error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/meta-catalog/produtos
router.get("/meta-catalog/produtos", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const rows = await db
      .select({
        id: metaProdutosTable.id,
        metaProductId: metaProdutosTable.metaProductId,
        retailerId: metaProdutosTable.retailerId,
        produtoId: metaProdutosTable.produtoId,
        ativo: metaProdutosTable.ativo,
        syncStatus: metaProdutosTable.syncStatus,
        ultimoSyncAt: metaProdutosTable.ultimoSyncAt,
        ultimoPreco: metaProdutosTable.ultimoPreco,
        ultimoDisponivel: metaProdutosTable.ultimoDisponivel,
        tentativas: metaProdutosTable.tentativas,
        ultimoErro: metaProdutosTable.ultimoErro,
      })
      .from(metaProdutosTable)
      .where(eq(metaProdutosTable.lojaId, lojaId));

    res.json(rows);
  } catch (err) {
    console.error("[meta-catalog] produtos list error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/meta-catalog/produtos
router.post("/meta-catalog/produtos", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { produtos } = req.body as {
      produtos: Array<{ metaProductId: string; retailerId?: string; produtoId: number }>;
    };

    if (!Array.isArray(produtos) || produtos.length === 0) {
      res.status(400).json({ error: "Array 'produtos' é obrigatório" });
      return;
    }

    let inserted = 0;
    for (const p of produtos) {
      if (!p.metaProductId || !p.produtoId) continue;

      const [existing] = await db
        .select({ id: metaProdutosTable.id })
        .from(metaProdutosTable)
        .where(and(eq(metaProdutosTable.metaProductId, p.metaProductId), eq(metaProdutosTable.lojaId, lojaId)));

      if (existing) {
        await db
          .update(metaProdutosTable)
          .set({ produtoId: p.produtoId, retailerId: p.retailerId ?? null, ativo: true })
          .where(eq(metaProdutosTable.id, existing.id));
      } else {
        await db.insert(metaProdutosTable).values({
          lojaId,
          metaProductId: p.metaProductId,
          retailerId: p.retailerId ?? null,
          produtoId: p.produtoId,
        });
      }
      inserted++;
    }

    res.json({ ok: true, total: inserted });
  } catch (err) {
    console.error("[meta-catalog] produtos save error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/meta-catalog/sincronizar
// Now async: enqueues jobs for the worker instead of calling Meta API directly
router.post("/meta-catalog/sincronizar", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const result = await sincronizarProdutos(lojaId);
    res.json({ async: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ event: "meta_sync_route_error", error: msg }));
    res.status(500).json({ success: false, error: msg });
  }
});

// POST /api/meta-catalog/enqueue
// Enqueue specific products (or all if omitted)
router.post("/meta-catalog/enqueue", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { produtoIds, prioridade } = req.body as { produtoIds?: number[]; prioridade?: number };
    const result = await enqueueMetaSync(lojaId, produtoIds, prioridade ?? 0);
    res.json({ async: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── Observability ──────────────────────────────────────────────────────────────

// GET /api/meta-catalog/metrics
// Returns Prometheus text format. Protected behind requireDono.
router.get("/meta-catalog/metrics", requireDono, (_req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(getPrometheusMetrics());
});

// GET /api/meta-catalog/status
// Snapshot of circuit breaker + rate limiter state per loja
router.get("/meta-catalog/status", requireDono, (req: AuthRequest, res) => {
  const lojaId = req.session!.lojaId;
  const cbStates = getAllStates();
  const rl = getRateLimitStatus(lojaId);
  res.json({
    circuitBreaker: cbStates,
    rateLimiter: { lojaId, ...rl },
  });
});

// GET /api/meta-catalog/jobs
// View job queue (pending/processing/dead) for the session's loja
router.get("/meta-catalog/jobs", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const status = (req.query as { status?: string }).status;
    const validStatuses = ["pending", "processing", "done", "failed", "dead"];

    const rows = await db
      .select({
        id: metaSyncJobsTable.id,
        produtoId: metaSyncJobsTable.produtoId,
        metaProductId: metaSyncJobsTable.metaProductId,
        status: metaSyncJobsTable.status,
        retryCount: metaSyncJobsTable.retryCount,
        maxRetries: metaSyncJobsTable.maxRetries,
        error: metaSyncJobsTable.error,
        scheduledAt: metaSyncJobsTable.scheduledAt,
        processedAt: metaSyncJobsTable.processedAt,
        traceId: metaSyncJobsTable.traceId,
      })
      .from(metaSyncJobsTable)
      .where(
        and(
          eq(metaSyncJobsTable.lojaId, lojaId),
          status && validStatuses.includes(status)
            ? eq(metaSyncJobsTable.status, status)
            : undefined,
        ),
      )
      .orderBy(desc(metaSyncJobsTable.scheduledAt))
      .limit(200);

    res.json(rows);
  } catch (err) {
    console.error("[meta-catalog] jobs list error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/meta-catalog/jobs/retry-failed
// Reset all dead jobs to pending for manual retry
router.post("/meta-catalog/jobs/retry-failed", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const result = await retryDeadJobs(lojaId);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[meta-catalog] retry-failed error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/meta-catalog/audit
// Paginated audit trail for the session's loja
router.get("/meta-catalog/audit", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const q = req.query as { limit?: string; offset?: string; produtoId?: string };
    const limit = Math.min(parseInt(q.limit ?? "50", 10) || 50, 200);
    const offset = parseInt(q.offset ?? "0", 10) || 0;
    const produtoId = q.produtoId ? parseInt(q.produtoId, 10) : undefined;

    const rows = await db
      .select()
      .from(metaSyncAuditTable)
      .where(
        and(
          eq(metaSyncAuditTable.lojaId, lojaId),
          produtoId ? eq(metaSyncAuditTable.produtoId, produtoId) : undefined,
        ),
      )
      .orderBy(desc(metaSyncAuditTable.criadoEm))
      .limit(limit)
      .offset(offset);

    res.json(rows);
  } catch (err) {
    console.error("[meta-catalog] audit list error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
