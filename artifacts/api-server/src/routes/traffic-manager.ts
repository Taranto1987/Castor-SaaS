import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  trafficManagerDecisionsTable,
  trafficManagerConfigTable,
  adMetricSnapshotsTable,
} from "@workspace/db/schema";
import { runTrafficManagerCycle } from "../lib/traffic-manager-agent";
import { isMetaAdsConfigured } from "../lib/meta-ads-client";
import { isCapiConfigured } from "../lib/meta-capi-client";

const router = Router();

// GET /traffic-manager/status
router.get("/traffic-manager/status", async (_req: Request, res: Response) => {
  const [lastDecision] = await db
    .select()
    .from(trafficManagerDecisionsTable)
    .orderBy(desc(trafficManagerDecisionsTable.decidedAt))
    .limit(1);

  const [config] = await db
    .select()
    .from(trafficManagerConfigTable)
    .where(eq(trafficManagerConfigTable.ativo, true))
    .limit(1);

  res.json({
    configured: {
      metaAds: isMetaAdsConfigured(),
      capi: isCapiConfigured(),
      geminiFlash: !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      notifyPhone: !!config?.notifyPhone,
    },
    config: config ?? null,
    lastDecision: lastDecision ?? null,
  });
});

// GET /traffic-manager/decisions?limit=20
router.get("/traffic-manager/decisions", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "20", 10), 100);

  const decisions = await db
    .select()
    .from(trafficManagerDecisionsTable)
    .orderBy(desc(trafficManagerDecisionsTable.decidedAt))
    .limit(limit);

  res.json({ decisions });
});

// GET /traffic-manager/snapshots?limit=50
router.get("/traffic-manager/snapshots", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "50", 10), 200);

  const snapshots = await db
    .select()
    .from(adMetricSnapshotsTable)
    .orderBy(desc(adMetricSnapshotsTable.capturedAt))
    .limit(limit);

  res.json({ snapshots });
});

// POST /traffic-manager/run — disparo manual
router.post("/traffic-manager/run", async (_req: Request, res: Response) => {
  try {
    const result = await runTrafficManagerCycle("manual");
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /traffic-manager/config
router.get("/traffic-manager/config", async (_req: Request, res: Response) => {
  const configs = await db.select().from(trafficManagerConfigTable);
  res.json({ configs });
});

// POST /traffic-manager/config
router.post("/traffic-manager/config", async (req: Request, res: Response) => {
  const {
    adAccountId,
    platform = "meta",
    maxDailyBudgetIncreasePct,
    maxCpaThresholdBrl,
    minRoasTarget,
    notifyPhone,
  } = req.body as Record<string, any>;

  if (!adAccountId) {
    res.status(400).json({ error: "adAccountId é obrigatório" });
    return;
  }

  const [saved] = await db
    .insert(trafficManagerConfigTable)
    .values({
      adAccountId,
      platform,
      maxDailyBudgetIncreasePct: maxDailyBudgetIncreasePct?.toString(),
      maxCpaThresholdBrl: maxCpaThresholdBrl?.toString(),
      minRoasTarget: minRoasTarget?.toString(),
      notifyPhone,
      ativo: true,
    })
    .onConflictDoNothing()
    .returning();

  res.json({ ok: true, config: saved });
});

// PATCH /traffic-manager/config/:id
router.patch("/traffic-manager/config/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"]!, 10);
  const { maxDailyBudgetIncreasePct, maxCpaThresholdBrl, minRoasTarget, notifyPhone, ativo } =
    req.body as Record<string, any>;

  const updates: Record<string, any> = { atualizadoEm: new Date() };
  if (maxDailyBudgetIncreasePct !== undefined)
    updates["maxDailyBudgetIncreasePct"] = maxDailyBudgetIncreasePct.toString();
  if (maxCpaThresholdBrl !== undefined)
    updates["maxCpaThresholdBrl"] = maxCpaThresholdBrl.toString();
  if (minRoasTarget !== undefined) updates["minRoasTarget"] = minRoasTarget.toString();
  if (notifyPhone !== undefined) updates["notifyPhone"] = notifyPhone;
  if (ativo !== undefined) updates["ativo"] = ativo;

  await db
    .update(trafficManagerConfigTable)
    .set(updates)
    .where(eq(trafficManagerConfigTable.id, id));

  res.json({ ok: true });
});

export default router;
