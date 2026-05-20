import { Router } from "express";
import { db, leadScoresTable, leadScoreHistoryTable, customerProfilesTable } from "@workspace/db";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { requireDono, type AuthRequest } from "../middlewares/auth";
import { computeScore } from "../services/scoring/engine";
import { CATEGORY_THRESHOLDS, getCategoryMeta } from "../services/scoring/weights";
import type { StoredSignals } from "../services/scoring/engine";

const router = Router();

/**
 * GET /api/scoring/leads
 * List all scored leads for the authenticated loja, ordered by score desc.
 * Query params: category, minScore, limit (max 200)
 */
router.get("/scoring/leads", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { category, minScore, limit: limitParam } = req.query;
    const limit = Math.min(Number(limitParam ?? 100), 200);

    const conditions = [eq(leadScoresTable.lojaId, lojaId)];
    if (category) conditions.push(eq(leadScoresTable.category, String(category)));
    if (minScore) conditions.push(gte(leadScoresTable.score, Number(minScore)));

    const rows = await db
      .select({
        customerId: leadScoresTable.customerId,
        score: leadScoresTable.score,
        category: leadScoresTable.category,
        trend: leadScoresTable.trend,
        closingProbability: leadScoresTable.closingProbability,
        sessionCount: leadScoresTable.sessionCount,
        totalMessages: leadScoresTable.totalMessages,
        lastSeenAt: leadScoresTable.lastSeenAt,
        firstSeenAt: leadScoresTable.firstSeenAt,
        phone: customerProfilesTable.phone,
        name: customerProfilesTable.name,
        anonymousId: customerProfilesTable.anonymousId,
      })
      .from(leadScoresTable)
      .leftJoin(customerProfilesTable, eq(leadScoresTable.customerId, customerProfilesTable.id))
      .where(and(...conditions))
      .orderBy(desc(leadScoresTable.score))
      .limit(limit);

    const leads = rows.map((r) => ({
      ...r,
      categoryMeta: getCategoryMeta(r.category as Parameters<typeof getCategoryMeta>[0]),
    }));

    res.json({ leads, categories: CATEGORY_THRESHOLDS });
  } catch (err) {
    console.error("[Scoring] /leads error:", err);
    res.status(500).json({ error: "Erro ao carregar leads" });
  }
});

/**
 * GET /api/scoring/lead/:customerId
 * Full score detail + history + breakdown for a single customer.
 */
router.get("/scoring/lead/:customerId", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const customerId = Number(req.params.customerId);
    if (isNaN(customerId)) {
      res.status(400).json({ error: "customerId inválido" });
      return;
    }

    const [scoreRow, profile, historyRows] = await Promise.all([
      db
        .select()
        .from(leadScoresTable)
        .where(and(eq(leadScoresTable.customerId, customerId), eq(leadScoresTable.lojaId, lojaId)))
        .limit(1),
      db
        .select()
        .from(customerProfilesTable)
        .where(eq(customerProfilesTable.id, customerId))
        .limit(1),
      db
        .select()
        .from(leadScoreHistoryTable)
        .where(eq(leadScoreHistoryTable.customerId, customerId))
        .orderBy(desc(leadScoreHistoryTable.criadoEm))
        .limit(30),
    ]);

    if (!scoreRow[0]) {
      res.status(404).json({ error: "Lead score não encontrado" });
      return;
    }

    const record = scoreRow[0];
    const signals = (record.signals ?? {}) as StoredSignals;

    // Re-run engine for full breakdown (never stored in DB to avoid denormalization)
    const computed = computeScore(signals, record.score, record.sessionCount ?? 0);

    res.json({
      customerId,
      profile: profile[0] ?? null,
      score: record.score,
      category: record.category,
      categoryMeta: getCategoryMeta(record.category as Parameters<typeof getCategoryMeta>[0]),
      trend: record.trend,
      closingProbability: record.closingProbability,
      sessionCount: record.sessionCount,
      totalMessages: record.totalMessages,
      lastSeenAt: record.lastSeenAt,
      firstSeenAt: record.firstSeenAt,
      breakdown: computed.breakdown,
      history: historyRows,
    });
  } catch (err) {
    console.error("[Scoring] /lead/:id error:", err);
    res.status(500).json({ error: "Erro ao carregar lead" });
  }
});

/**
 * GET /api/scoring/overview
 * Aggregated funnel metrics for the loja.
 */
router.get("/scoring/overview", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;

    const rows = await db
      .select({
        score: leadScoresTable.score,
        category: leadScoresTable.category,
        trend: leadScoresTable.trend,
        closingProbability: leadScoresTable.closingProbability,
        sessionCount: leadScoresTable.sessionCount,
      })
      .from(leadScoresTable)
      .where(eq(leadScoresTable.lojaId, lojaId));

    const total = rows.length;
    const distribution: Record<string, number> = {};
    let sumScore = 0;
    let highPotential = 0;
    let rising = 0;
    let multiSession = 0;

    for (const r of rows) {
      distribution[r.category] = (distribution[r.category] ?? 0) + 1;
      sumScore += r.score;
      if (r.closingProbability >= 0.5) highPotential++;
      if (r.trend === "rising") rising++;
      if ((r.sessionCount ?? 0) > 1) multiSession++;
    }

    // Funnel view: ordered categories with counts
    const funnel = CATEGORY_THRESHOLDS.map((meta) => ({
      ...meta,
      count: distribution[meta.category] ?? 0,
    }));

    res.json({
      total,
      avgScore: total > 0 ? Math.round((sumScore / total) * 10) / 10 : 0,
      highPotential,
      rising,
      multiSession,
      funnel,
    });
  } catch (err) {
    console.error("[Scoring] /overview error:", err);
    res.status(500).json({ error: "Erro ao carregar overview" });
  }
});

/**
 * GET /api/scoring/hot-leads
 * Convenience endpoint: returns leads with closingProbability >= 0.5, ordered by probability desc.
 * Designed for sales alerts and action queues.
 */
router.get("/scoring/hot-leads", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;

    const rows = await db
      .select({
        customerId: leadScoresTable.customerId,
        score: leadScoresTable.score,
        category: leadScoresTable.category,
        trend: leadScoresTable.trend,
        closingProbability: leadScoresTable.closingProbability,
        sessionCount: leadScoresTable.sessionCount,
        lastSeenAt: leadScoresTable.lastSeenAt,
        phone: customerProfilesTable.phone,
        name: customerProfilesTable.name,
      })
      .from(leadScoresTable)
      .leftJoin(customerProfilesTable, eq(leadScoresTable.customerId, customerProfilesTable.id))
      .where(and(
        eq(leadScoresTable.lojaId, lojaId),
        gte(leadScoresTable.closingProbability, 0.5),
      ))
      .orderBy(desc(leadScoresTable.closingProbability))
      .limit(50);

    res.json({
      leads: rows.map((r) => ({
        ...r,
        categoryMeta: getCategoryMeta(r.category as Parameters<typeof getCategoryMeta>[0]),
      })),
    });
  } catch (err) {
    console.error("[Scoring] /hot-leads error:", err);
    res.status(500).json({ error: "Erro ao carregar hot leads" });
  }
});

/**
 * GET /api/scoring/trend-history
 * Score evolution over time for charting (aggregated daily average per category).
 */
router.get("/scoring/trend-history", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const days = Math.min(Number(req.query.days ?? 30), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        day: sql<string>`DATE_TRUNC('day', ${leadScoreHistoryTable.criadoEm})::date`,
        avgScore: sql<number>`AVG(${leadScoreHistoryTable.score})`,
        count: sql<number>`COUNT(DISTINCT ${leadScoreHistoryTable.customerId})`,
      })
      .from(leadScoreHistoryTable)
      .where(
        and(
          eq(leadScoreHistoryTable.lojaId, lojaId),
          gte(leadScoreHistoryTable.criadoEm, since),
        ),
      )
      .groupBy(sql`DATE_TRUNC('day', ${leadScoreHistoryTable.criadoEm})`)
      .orderBy(sql`DATE_TRUNC('day', ${leadScoreHistoryTable.criadoEm})`);

    res.json({
      period: { days, since: since.toISOString() },
      history: rows.map((r) => ({
        day: r.day,
        avgScore: Math.round(Number(r.avgScore) * 10) / 10,
        leadsActive: Number(r.count),
      })),
    });
  } catch (err) {
    console.error("[Scoring] /trend-history error:", err);
    res.status(500).json({ error: "Erro ao carregar histórico" });
  }
});

export default router;
