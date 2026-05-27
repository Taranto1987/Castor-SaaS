import {
  type LeadCategory,
  type CategoryMeta,
  type SignalKey,
  type StoredSignals,
  SCORE_WEIGHTS,
  CATEGORY_THRESHOLDS,
  getCategoryMeta,
} from "./weights";

export type { StoredSignals, SignalKey, LeadCategory };

export interface AppliedSignal {
  signal: SignalKey;
  label: string;
  points: number;
  applications: number;
  totalContribution: number;
}

export interface ScoreBreakdown {
  positive: AppliedSignal[];
  negative: AppliedSignal[];
  rawScore: number;
}

export interface ScoreResult {
  score: number;
  category: LeadCategory;
  categoryMeta: CategoryMeta;
  trend: "rising" | "stable" | "cooling";
  closingProbability: number;
  breakdown: ScoreBreakdown;
  signals: StoredSignals;
  delta: number;
  decayPenalty: number;
}

/** Merge incoming session signals into existing accumulated signals, respecting maxApplications caps. */
export function applySignals(
  existing: StoredSignals,
  incoming: StoredSignals,
): StoredSignals {
  const merged: StoredSignals = { ...existing };

  for (const [key, count] of Object.entries(incoming) as [SignalKey, number][]) {
    if (!count || count <= 0) continue;
    const weight = SCORE_WEIGHTS[key];
    if (!weight) continue;
    const current = merged[key] ?? 0;
    const headroom = weight.maxApplications - current;
    const applied = Math.min(count, headroom);
    if (applied > 0) merged[key] = current + applied;
  }

  return merged;
}

/** Recompute full score from stored signals. Pure function — no side effects. */
export function computeScore(
  signals: StoredSignals,
  previousScore: number,
  sessionCount: number,
  lastSeenAt: Date = new Date(),
): ScoreResult {
  const positive: AppliedSignal[] = [];
  const negative: AppliedSignal[] = [];
  let rawScore = 0;

  for (const [key, applications] of Object.entries(signals) as [SignalKey, number][]) {
    if (!applications || applications <= 0) continue;
    const weight = SCORE_WEIGHTS[key];
    if (!weight) continue;
    const totalContribution = weight.points * applications;
    rawScore += totalContribution;
    const entry: AppliedSignal = {
      signal: key,
      label: weight.label,
      points: weight.points,
      applications,
      totalContribution,
    };
    if (weight.points >= 0) positive.push(entry);
    else negative.push(entry);
  }

  positive.sort((a, b) => b.totalContribution - a.totalContribution);
  negative.sort((a, b) => a.totalContribution - b.totalContribution);

  const daysSinceLastSeen = (Date.now() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayDays = Math.max(0, daysSinceLastSeen - 7);
  const decayPenalty = Math.round(Math.min(decayDays * 0.5, 30) * 10) / 10;

  const score = Math.max(0, Math.min(100, Math.round((rawScore - decayPenalty) * 10) / 10));
  const delta = Math.round((score - previousScore) * 10) / 10;

  const category = (CATEGORY_THRESHOLDS.find((t) => score >= t.minScore) ?? CATEGORY_THRESHOLDS[5]).category;
  const categoryMeta = getCategoryMeta(category);

  const trend: "rising" | "stable" | "cooling" =
    delta > 5 ? "rising" : delta < -5 ? "cooling" : "stable";

  const closingProbability = computeClosingProbability(score, sessionCount);

  return {
    score,
    category,
    categoryMeta,
    trend,
    closingProbability,
    breakdown: { positive, negative, rawScore },
    signals,
    delta,
    decayPenalty,
  };
}

function computeClosingProbability(score: number, sessionCount: number): number {
  // Non-linear: probability accelerates steeply above 70
  let base: number;
  if (score < 15)      base = score * 0.002;
  else if (score < 35) base = 0.03  + (score - 15) * 0.003;
  else if (score < 55) base = 0.09  + (score - 35) * 0.008;
  else if (score < 70) base = 0.25  + (score - 55) * 0.017;
  else if (score < 85) base = 0.505 + (score - 70) * 0.017;
  else                 base = 0.76  + (score - 85) * 0.013;

  const sessionBonus = Math.min(0.08, Math.max(0, sessionCount - 1) * 0.02);
  return Math.round(Math.min(0.97, base + sessionBonus) * 1000) / 1000;
}
