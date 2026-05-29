import { db, aiUsageTable } from "@workspace/db";

type AIUsageParams = {
  lojaId:       number;
  modelo:       string;
  inputTokens:  number;
  outputTokens: number;
  cacheTokens?: number;
  custoEstimado: number;
  contexto:     "chat" | "waha" | "capsule" | "lead";
  requestId?:   string;
};

export async function trackAIUsage(params: AIUsageParams): Promise<void> {
  try {
    await db.insert(aiUsageTable).values({
      lojaId:        params.lojaId,
      modelo:        params.modelo,
      inputTokens:   params.inputTokens,
      outputTokens:  params.outputTokens,
      cacheTokens:   params.cacheTokens ?? 0,
      custoEstimado: String(params.custoEstimado),
      contexto:      params.contexto,
      requestId:     params.requestId ?? null,
    });
  } catch (err) {
    // Tracking never blocks the main flow
    console.error("[ai-usage] Failed to persist usage:", err);
  }
}
