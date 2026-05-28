import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/deep", async (_req, res) => {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      db: "healthy",
      dbResponseMs: Date.now() - start,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
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
