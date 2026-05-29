import { Router } from "express";
import { db } from "@workspace/db";
import {
  customerProfilesTable, leadScoresTable, relationalCapsulesTable,
  diagnosticosTable, sleepOutcomesTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireDono, type AuthRequest } from "../middlewares/auth";

const router = Router();

/**
 * GET /api/twin/:customerId
 * Unified Digital Twin view — aggregates all customer data from every layer.
 */
router.get("/twin/:customerId", requireDono, async (req: AuthRequest, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);
    const lojaId     = req.session!.lojaId;

    const [identity, score, capsule, diagnosticos] = await Promise.all([
      db.select().from(customerProfilesTable)
        .where(and(eq(customerProfilesTable.id, customerId), eq(customerProfilesTable.lojaId, lojaId)))
        .limit(1),

      db.select().from(leadScoresTable)
        .where(and(eq(leadScoresTable.customerId, customerId), eq(leadScoresTable.lojaId, lojaId)))
        .limit(1),

      db.select().from(relationalCapsulesTable)
        .where(and(eq(relationalCapsulesTable.customerId, customerId), eq(relationalCapsulesTable.lojaId, lojaId)))
        .limit(1),

      db.select().from(diagnosticosTable)
        .where(and(eq(diagnosticosTable.customerId, customerId), eq(diagnosticosTable.lojaId, lojaId)))
        .orderBy(desc(diagnosticosTable.criadoEm))
        .limit(5),
    ]);

    if (!identity[0]) {
      res.status(404).json({ error: "customer not found" });
      return;
    }

    // Fetch outcomes for the most recent diagnostico
    const latestDiag = diagnosticos[0];
    const outcomes = latestDiag
      ? await db.select().from(sleepOutcomesTable)
          .where(eq(sleepOutcomesTable.diagnosticoId, latestDiag.id))
          .orderBy(desc(sleepOutcomesTable.criadoEm))
          .limit(1)
      : [];

    res.json({
      identity:      identity[0],
      score:         score[0]   ?? null,
      capsule:       capsule[0] ?? null,
      diagnosticos,
      latest_outcome: outcomes[0] ?? null,
    });
  } catch (err) {
    console.error("[twin] fetch error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

/**
 * GET /api/twin/by-phone/:phone
 * Resolve twin by WhatsApp number — used by Thalles when looking up a customer.
 */
router.get("/twin/by-phone/:phone", requireDono, async (req: AuthRequest, res) => {
  try {
    const phone   = req.params.phone.replace(/\D/g, "");
    const lojaId  = req.session!.lojaId;

    const [identity] = await db.select()
      .from(customerProfilesTable)
      .where(and(eq(customerProfilesTable.phone, phone), eq(customerProfilesTable.lojaId, lojaId)))
      .limit(1);

    if (!identity) {
      res.status(404).json({ error: "customer not found" });
      return;
    }

    // Redirect to the full twin view
    res.redirect(`/api/twin/${identity.id}`);
  } catch (err) {
    console.error("[twin] by-phone error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
