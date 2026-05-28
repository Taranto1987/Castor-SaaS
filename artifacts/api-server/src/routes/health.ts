import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool, db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/deep", async (_req, res) => {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");

    // ai_usage: last 24h aggregated per loja
    const aiUsage24h = await db.execute(sql`
      SELECT loja_id, COUNT(*)::int AS requests, SUM(custo_estimado)::float AS cost_usd
      FROM ai_usage
      WHERE criado_em > NOW() - INTERVAL '24 hours'
      GROUP BY loja_id
      ORDER BY loja_id
    `).catch(() => ({ rows: [] }));

    // scheduler_locks: table exists?
    const schedulerLocksExists = await db.execute(sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'scheduler_locks' LIMIT 1
    `).then(r => r.rows.length > 0).catch(() => false);

    res.json({
      status: "ok",
      db: "healthy",
      dbResponseMs: Date.now() - start,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      ai_usage_24h: (aiUsage24h as any).rows,
      scheduler_locks_table: schedulerLocksExists,
      env: {
        features: {
          anthropic:  !!process.env.ANTHROPIC_API_KEY,
          evolution:  !!process.env.EVOLUTION_API_URL,
          waha:       !!process.env.WAHA_URL,
          gemini:     !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        },
      },
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      db: "unreachable",
      dbResponseMs: Date.now() - start,
      error: String(err),
    });
  }
});

export default router;
