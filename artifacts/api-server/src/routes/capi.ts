import { Router, type Request, type Response } from "express";
import { desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { capiEventsTable } from "@workspace/db/schema";
import { sendLeadEvent, sendPurchaseEvent, isCapiConfigured } from "../lib/meta-capi-client";

const router = Router();

// POST /capi/lead — disparo manual ou do frontend
router.post("/capi/lead", async (req: Request, res: Response) => {
  const { phone, name, leadScore, valueEstimated } = req.body as Record<string, any>;

  try {
    await sendLeadEvent({ phone, name, leadScore, valueEstimated });
    res.json({ ok: true, configured: isCapiConfigured() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /capi/purchase — chamado quando orçamento muda para "vendido"
router.post("/capi/purchase", async (req: Request, res: Response) => {
  const { phone, name, value, orderId } = req.body as Record<string, any>;

  if (!value) {
    res.status(400).json({ error: "value é obrigatório" });
    return;
  }

  try {
    await sendPurchaseEvent({ phone, name, value: parseFloat(value), orderId });
    res.json({ ok: true, configured: isCapiConfigured() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /capi/events?limit=50
router.get("/capi/events", async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "50", 10), 200);

  const events = await db
    .select()
    .from(capiEventsTable)
    .orderBy(desc(capiEventsTable.criadoEm))
    .limit(limit);

  res.json({ events, configured: isCapiConfigured() });
});

export default router;
