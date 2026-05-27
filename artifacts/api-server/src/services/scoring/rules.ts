import type { StoredSignals } from "./weights";
import type { ScoreResult } from "./engine";

export interface AutomationContext {
  customerId: number;
  lojaId: number;
  name: string | null;
  phone: string | null;
  previousScore: number;
  result: ScoreResult;
  incomingSignals: StoredSignals;
}

export interface AutomationRule {
  id: string;
  /** Minimum score to trigger. Only fires on upward crossing (previousScore < threshold). */
  scoreThreshold?: number;
  /** Signal that, if present in incomingSignals, triggers this rule. */
  triggerSignal?: keyof StoredSignals;
  /** Hours before the same rule can fire again for the same customer. */
  cooldownHours: number;
  buildMessage: (ctx: AutomationContext) => string;
}

export const AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "lead_quente_70",
    scoreThreshold: 70,
    cooldownHours: 24,
    buildMessage: ({ name, result }) =>
      `🔥 *Lead Quente Detectado!*\n\n` +
      `Cliente: ${name ?? "anônimo"}\n` +
      `Score: ${result.score} pontos\n` +
      `Categoria: ${result.categoryMeta.label}\n` +
      `Probabilidade de fechamento: ${(result.closingProbability * 100).toFixed(0)}%\n` +
      `Tendência: ${result.trend === "rising" ? "📈 subindo" : result.trend === "cooling" ? "📉 esfriando" : "➡️ estável"}\n\n` +
      `${buildSignalSummary(result)}\n` +
      `_Entre em contato agora — o momento é favorável._`,
  },
  {
    id: "alta_probabilidade_85",
    scoreThreshold: 85,
    cooldownHours: 48,
    buildMessage: ({ name, result }) =>
      `🎯 *ALTA PROBABILIDADE DE FECHAMENTO!*\n\n` +
      `Cliente: ${name ?? "anônimo"}\n` +
      `Score: ${result.score} — ${result.categoryMeta.label}\n` +
      `Probabilidade: *${(result.closingProbability * 100).toFixed(0)}%*\n\n` +
      `${buildSignalSummary(result)}\n` +
      `_Contato imediato recomendado. Este lead está pronto para comprar._`,
  },
  {
    id: "retorno_apos_abandono",
    triggerSignal: "return_after_abandonment",
    cooldownHours: 12,
    buildMessage: ({ name, result }) =>
      `↩️ *Lead Voltou Após Abandono!*\n\n` +
      `Cliente: ${name ?? "anônimo"}\n` +
      `Score atual: ${result.score} (${result.categoryMeta.label})\n\n` +
      `_O cliente que havia saído sem comprar retornou. Boa janela de oportunidade._`,
  },
  {
    id: "lead_capturado",
    triggerSignal: "lead_captured",
    cooldownHours: 72,
    buildMessage: ({ name, phone, result }) =>
      `📲 *Lead Capturado!*\n\n` +
      `Nome: ${name ?? "não informado"}\n` +
      `Telefone: ${phone ?? "não informado"}\n` +
      `Score: ${result.score} (${result.categoryMeta.label})\n\n` +
      `_Contato disponível — adicione ao CRM e inicie follow-up._`,
  },
];

function buildSignalSummary(result: ScoreResult): string {
  const top = result.breakdown.positive.slice(0, 3);
  if (top.length === 0) return "";
  const lines = top.map((s) => `• ${s.label}`).join("\n");
  return `*Sinais detectados:*\n${lines}`;
}
