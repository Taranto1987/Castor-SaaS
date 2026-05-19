import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatEventsTable } from "@workspace/db/schema";
import { sql, eq, and, gte } from "drizzle-orm";
import { requireDono, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/analytics/chat", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const days = Math.min(parseInt(String(req.query.days ?? "30"), 10) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const baseFilter = and(
      eq(chatEventsTable.lojaId, lojaId),
      gte(chatEventsTable.criadoEm, since)
    );

    const [sessions, leads, intentRows, painRows, objectionRows, activityRows] =
      await Promise.all([
        // unique sessions
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${chatEventsTable.sessionId})` })
          .from(chatEventsTable)
          .where(and(baseFilter, eq(chatEventsTable.eventType, "session_started"))),

        // leads captured
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(chatEventsTable)
          .where(and(baseFilter, eq(chatEventsTable.eventType, "lead_captured"))),

        // intent distribution
        db
          .select({
            intent: sql<string>`${chatEventsTable.payload}->>'intent'`,
            count: sql<number>`COUNT(*)`,
          })
          .from(chatEventsTable)
          .where(and(baseFilter, eq(chatEventsTable.eventType, "intent_classified")))
          .groupBy(sql`${chatEventsTable.payload}->>'intent'`)
          .orderBy(sql`COUNT(*) DESC`),

        // top pains
        db
          .select({
            pain: sql<string>`${chatEventsTable.payload}->>'pain'`,
            count: sql<number>`COUNT(*)`,
          })
          .from(chatEventsTable)
          .where(and(baseFilter, eq(chatEventsTable.eventType, "pain_detected")))
          .groupBy(sql`${chatEventsTable.payload}->>'pain'`)
          .orderBy(sql`COUNT(*) DESC`),

        // top objections
        db
          .select({
            objection: sql<string>`${chatEventsTable.payload}->>'objection'`,
            count: sql<number>`COUNT(*)`,
          })
          .from(chatEventsTable)
          .where(and(baseFilter, eq(chatEventsTable.eventType, "objection_detected")))
          .groupBy(sql`${chatEventsTable.payload}->>'objection'`)
          .orderBy(sql`COUNT(*) DESC`),

        // sessions per day
        db
          .select({
            day: sql<string>`DATE_TRUNC('day', ${chatEventsTable.criadoEm})::date`,
            count: sql<number>`COUNT(DISTINCT ${chatEventsTable.sessionId})`,
          })
          .from(chatEventsTable)
          .where(and(baseFilter, eq(chatEventsTable.eventType, "session_started")))
          .groupBy(sql`DATE_TRUNC('day', ${chatEventsTable.criadoEm})`)
          .orderBy(sql`DATE_TRUNC('day', ${chatEventsTable.criadoEm})`),
      ]);

    const totalSessions = Number(sessions[0]?.count ?? 0);
    const totalLeads = Number(leads[0]?.count ?? 0);

    res.json({
      period: { days, since: since.toISOString() },
      overview: {
        sessions: totalSessions,
        leadsCapturados: totalLeads,
        taxaConversao: totalSessions > 0
          ? parseFloat(((totalLeads / totalSessions) * 100).toFixed(1))
          : 0,
      },
      intentDistribution: intentRows.map((r) => ({
        intent: r.intent,
        count: Number(r.count),
      })),
      topPains: painRows.map((r) => ({ pain: r.pain, count: Number(r.count) })),
      topObjections: objectionRows.map((r) => ({
        objection: r.objection,
        count: Number(r.count),
      })),
      actividadePorDia: activityRows.map((r) => ({
        day: r.day,
        sessions: Number(r.count),
      })),
    });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    res.status(500).json({ error: "Erro ao carregar analytics" });
  }
});

export default router;
