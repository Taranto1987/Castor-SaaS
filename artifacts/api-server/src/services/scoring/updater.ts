import { db, leadScoresTable, leadScoreHistoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { applySignals, computeScore, type StoredSignals } from "./engine";

export async function persistLeadScore(
  customerId: number,
  lojaId: number,
  incomingSignals: StoredSignals,
  sessionCount: number,
  totalMessages: number,
  triggerEvent = "session_update",
): Promise<void> {
  const existing = await db
    .select()
    .from(leadScoresTable)
    .where(eq(leadScoresTable.customerId, customerId))
    .limit(1);

  const existingRecord = existing[0] ?? null;
  const existingSignals = (existingRecord?.signals ?? {}) as StoredSignals;
  const previousScore = existingRecord?.score ?? 0;

  const mergedSignals = applySignals(existingSignals, incomingSignals);
  const result = computeScore(mergedSignals, previousScore, sessionCount);

  const now = new Date();

  if (existingRecord) {
    await db
      .update(leadScoresTable)
      .set({
        score: result.score,
        category: result.category,
        signals: result.signals,
        trend: result.trend,
        closingProbability: result.closingProbability,
        sessionCount,
        totalMessages,
        lastSeenAt: now,
        atualizadoEm: now,
      })
      .where(eq(leadScoresTable.customerId, customerId));
  } else {
    await db.insert(leadScoresTable).values({
      customerId,
      lojaId,
      score: result.score,
      category: result.category,
      signals: result.signals,
      trend: result.trend,
      closingProbability: result.closingProbability,
      sessionCount,
      totalMessages,
      lastSeenAt: now,
      firstSeenAt: now,
      atualizadoEm: now,
    });
  }

  // Always record history for auditability and trend analysis
  await db.insert(leadScoreHistoryTable).values({
    customerId,
    lojaId,
    score: result.score,
    category: result.category,
    delta: result.delta,
    triggerEvent,
  });
}

/** Fire-and-forget wrapper — never blocks the HTTP response. */
export function scheduleLeadScoreUpdate(
  customerId: number,
  lojaId: number,
  incomingSignals: StoredSignals,
  sessionCount: number,
  totalMessages: number,
): void {
  setImmediate(() => {
    persistLeadScore(customerId, lojaId, incomingSignals, sessionCount, totalMessages).catch(
      (err) => console.error("[Scoring] Failed to update lead score:", customerId, err),
    );
  });
}
