import { db, automationLogTable, lojasTable, customerProfilesTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { enviarWhatsApp } from "../whatsapp";
import { AUTOMATION_RULES, type AutomationContext } from "./rules";
import type { ScoreResult, StoredSignals } from "./engine";

interface AutomationInput {
  customerId: number;
  lojaId: number;
  previousScore: number;
  result: ScoreResult;
  incomingSignals: StoredSignals;
}

export async function checkAndFireAutomations(input: AutomationInput): Promise<void> {
  const { customerId, lojaId, previousScore, result, incomingSignals } = input;

  // Load alert destination from loja config + customer profile (for personalized messages)
  const [lojaRows, profileRows] = await Promise.all([
    db.select({ configJson: lojasTable.configJson }).from(lojasTable).where(eq(lojasTable.id, lojaId)).limit(1),
    db.select({ name: customerProfilesTable.name, phone: customerProfilesTable.phone })
      .from(customerProfilesTable).where(eq(customerProfilesTable.id, customerId)).limit(1),
  ]);

  const configJson = (lojaRows[0]?.configJson ?? {}) as Record<string, unknown>;
  const alertPhone = configJson.alertaWhatsapp as string | undefined;
  const profile = profileRows[0] ?? null;

  const ctx: AutomationContext = {
    customerId,
    lojaId,
    name: profile?.name ?? null,
    phone: profile?.phone ?? null,
    previousScore,
    result,
    incomingSignals,
  };

  for (const rule of AUTOMATION_RULES) {
    const shouldTrigger = evaluateTrigger(rule, previousScore, result.score, incomingSignals);
    if (!shouldTrigger) continue;

    const alreadyFired = await isOnCooldown(customerId, lojaId, rule.id, rule.cooldownHours);
    if (alreadyFired) continue;

    const message = rule.buildMessage(ctx);

    // Persist the log entry regardless of whether WhatsApp is configured
    await db.insert(automationLogTable).values({
      customerId,
      lojaId,
      ruleId: rule.id,
      score: result.score,
      category: result.category,
      channel: alertPhone ? "whatsapp" : "log",
      destination: alertPhone ?? null,
      payload: { message: message.slice(0, 500), previousScore },
    });

    if (alertPhone) {
      await enviarWhatsApp(alertPhone, message);
      console.log(`[Automations] Fired rule "${rule.id}" → ${alertPhone}`);
    } else {
      console.log(`[Automations] Rule "${rule.id}" triggered (no alertaWhatsapp configured):`, message);
    }
  }
}

function evaluateTrigger(
  rule: (typeof AUTOMATION_RULES)[0],
  previousScore: number,
  currentScore: number,
  signals: StoredSignals,
): boolean {
  if (rule.scoreThreshold !== undefined) {
    // Only trigger on upward threshold crossing — prevents re-firing on stagnant scores
    return previousScore < rule.scoreThreshold && currentScore >= rule.scoreThreshold;
  }
  if (rule.triggerSignal) {
    return (signals[rule.triggerSignal] ?? 0) > 0;
  }
  return false;
}

async function isOnCooldown(
  customerId: number,
  lojaId: number,
  ruleId: string,
  cooldownHours: number,
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  const rows = await db
    .select({ id: automationLogTable.id })
    .from(automationLogTable)
    .where(
      and(
        eq(automationLogTable.customerId, customerId),
        eq(automationLogTable.lojaId, lojaId),
        eq(automationLogTable.ruleId, ruleId),
        gte(automationLogTable.dispararadoEm, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
