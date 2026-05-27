import { getProductContext } from "./repository";
import { resolveOrCreateCustomer } from "../memory/identity";
import { loadCapsule } from "../memory/capsule";
import type { ChatMessage } from "./lead-extractor";
import type { TruthState } from "./truth-state";

export async function buildTruthState(params: {
  messages: ChatMessage[];
  lojaId: number;
  sessionId: string;
  anonymousId?: string;
}): Promise<TruthState> {
  const { messages, lojaId, sessionId, anonymousId } = params;

  const [productContext, customerProfile] = await Promise.all([
    getProductContext(lojaId),
    anonymousId
      ? resolveOrCreateCustomer(anonymousId, lojaId).catch((err) => {
          console.error("[ContextBuilder] identity resolution failed:", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const customerId = customerProfile?.id ?? null;

  const memory = customerId
    ? await loadCapsule(customerId).catch(() => null)
    : null;

  console.log(
    `[ContextBuilder] lojaId=${lojaId} customerId=${customerId ?? "anon"} capsule=${memory ? "yes" : "no"} sessions=${memory?.sessionCount ?? 0}`,
  );

  const conversationHistory = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-10)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  return {
    lojaId,
    customerId,
    sessionId,
    anonymousId: anonymousId ?? null,
    memory,
    isReturningCustomer: memory !== null && (memory.sessionCount ?? 0) >= 1,
    productContext,
    conversationHistory,
  };
}
