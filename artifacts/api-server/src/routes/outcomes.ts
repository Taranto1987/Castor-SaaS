import { Router } from "express";
import { db } from "@workspace/db";
import { sleepOutcomesTable, diagnosticosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireDono, type AuthRequest } from "../middlewares/auth";

const router = Router();

/**
 * POST /api/outcomes
 * Thalles registers a sale outcome after a Mapa do Sono diagnosis.
 * Body: { diagnosticoId, vendeu, produto_vendido, ticket }
 */
router.post("/outcomes", requireDono, async (req: AuthRequest, res) => {
  try {
    const { diagnosticoId, vendeu, produto_vendido, ticket } = req.body;

    if (!diagnosticoId) {
      res.status(400).json({ error: "diagnosticoId required" });
      return;
    }

    // Fetch diagnostico to inherit customerId
    const [diag] = await db
      .select({ customerId: diagnosticosTable.customerId, lojaId: diagnosticosTable.lojaId })
      .from(diagnosticosTable)
      .where(eq(diagnosticosTable.id, diagnosticoId))
      .limit(1);

    if (!diag) {
      res.status(404).json({ error: "diagnostico not found" });
      return;
    }

    const [outcome] = await db
      .insert(sleepOutcomesTable)
      .values({
        diagnosticoId,
        customerId:      diag.customerId ?? undefined,
        lojaId:          diag.lojaId ?? 1,
        vendeu:          vendeu ?? null,
        produto_vendido: produto_vendido ?? null,
        ticket:          ticket ? String(ticket) : null,
        registradoEm:    new Date(),
      })
      .returning();

    res.status(201).json(outcome);
  } catch (err) {
    console.error("[outcomes] create error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * PATCH /api/outcomes/:id
 * Update satisfaction checkpoints (30d, 90d, 180d, 365d) and calculate Sleep Success Score.
 */
router.patch("/outcomes/:id", requireDono, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const {
      satisfacao_30d, satisfacao_90d, satisfacao_180d, satisfacao_365d,
      dor_melhorou, trocou, motivo_troca, indicou, nps,
    } = req.body;

    const updates: Partial<typeof sleepOutcomesTable.$inferInsert> = {
      atualizadoEm: new Date(),
    };

    if (satisfacao_30d  != null) updates.satisfacao_30d  = satisfacao_30d;
    if (satisfacao_90d  != null) updates.satisfacao_90d  = satisfacao_90d;
    if (satisfacao_180d != null) updates.satisfacao_180d = satisfacao_180d;
    if (satisfacao_365d != null) updates.satisfacao_365d = satisfacao_365d;
    if (dor_melhorou    != null) updates.dor_melhorou    = dor_melhorou;
    if (trocou          != null) updates.trocou          = trocou;
    if (motivo_troca    != null) updates.motivo_troca    = motivo_troca;
    if (indicou         != null) updates.indicou         = indicou;
    if (nps             != null) updates.nps             = nps;

    // Calculate Sleep Success Score when enough checkpoints are filled
    const [current] = await db
      .select()
      .from(sleepOutcomesTable)
      .where(eq(sleepOutcomesTable.id, id))
      .limit(1);

    if (current) {
      const merged = { ...current, ...updates };
      const score = calcSleepSuccessScore(merged);
      if (score !== null) updates.sleep_success_score = String(score);
    }

    const [updated] = await db
      .update(sleepOutcomesTable)
      .set(updates)
      .where(eq(sleepOutcomesTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("[outcomes] update error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /api/outcomes/diagnostico/:diagnosticoId
 * Get the outcome record(s) linked to a specific diagnosis.
 */
router.get("/outcomes/diagnostico/:diagnosticoId", requireDono, async (req: AuthRequest, res) => {
  try {
    const diagnosticoId = parseInt(req.params.diagnosticoId as string, 10);
    const rows = await db
      .select()
      .from(sleepOutcomesTable)
      .where(eq(sleepOutcomesTable.diagnosticoId, diagnosticoId));
    res.json(rows);
  } catch (err) {
    console.error("[outcomes] fetch error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

// Sleep Success Score formula:
// Weights: satisfacao (40%), dor_melhorou (20%), sem_troca (20%), nps_normalizado (20%)
// Only calculated when at minimum 90d satisfaction is present.
function calcSleepSuccessScore(
  r: Partial<SleepOutcomeRow>
): number | null {
  const sat = r.satisfacao_90d ?? r.satisfacao_180d ?? r.satisfacao_365d;
  if (!sat) return null; // not enough data yet

  const satScore    = ((Number(sat) - 1) / 4) * 100;           // 1-5 → 0-100
  const dorScore    = r.dor_melhorou == null ? 75 : r.dor_melhorou ? 100 : 40;
  const trocaScore  = r.trocou == null ? 85 : r.trocou ? 20 : 100;
  const npsScore    = r.nps != null ? (Number(r.nps) / 10) * 100 : 75;

  const raw = satScore * 0.4 + dorScore * 0.2 + trocaScore * 0.2 + npsScore * 0.2;
  return Math.round(raw * 100) / 100;
}

type SleepOutcomeRow = typeof sleepOutcomesTable.$inferSelect;

export default router;
