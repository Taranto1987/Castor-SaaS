import type { MessageClassification } from "../events/classifier";
import type { CapsuleState } from "../memory/capsule";
import type { StoredSignals } from "./engine";

const DELIVERY_RE = /entrega|prazo|frete|quando chega|demora|entregam/i;
const WARRANTY_RE = /garantia|anos de garantia|meses de garantia|cobertura/i;
const DIMENSIONS_RE = /medida|tamanho|casal|queen|king|solteiro|\bcm\b|dimensão/i;
const PREMIUM_RE = /premium|o melhor|top de linha|luxo|o mais caro|superior|alta qualidade|linha exclusiva/i;
const EXPLICIT_INTENT_RE = /quero comprar|vou comprar|quero levar|me interessa|quero fechar|vou fechar|quando posso|como faço pra comprar|quero esse/i;
const INDECISION_RE = /vou pensar|deixa eu pensar|não sei|talvez|quem sabe|preciso ver|não tenho certeza|vou considerar|depois vejo/i;
const ABANDONMENT_CAPSULE_RE = /abandonou|saiu sem comprar|não retornou|desapareceu|sumiu|não fechou/i;

type ChatMessage = { role: string; content: string };

/**
 * Derive scoring signals for the current session from the full conversation,
 * classifier output, and relational capsule state.
 */
export function extractSessionSignals(
  messages: ChatMessage[],
  classification: MessageClassification,
  capsuleState: CapsuleState | null,
  productIds: number[],
  leadCaptured: boolean,
): StoredSignals {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const signals: StoredSignals = {};

  // Session recurrence — if there's a capsule with prior sessions, this is a return visit
  const sessionCount = capsuleState?.sessionCount ?? 0;
  if (sessionCount >= 1) signals.session_return = 1;

  // Pain signals from classifier (all messages were analyzed upstream)
  if (classification.pains.length > 0) {
    signals.pain_detected = Math.min(classification.pains.length, 3);
  }

  // Objection signals
  for (const obj of classification.objections) {
    if (obj === "price")       signals.price_objection   = (signals.price_objection   ?? 0) + 1;
    if (obj === "thinking")    signals.indecision         = (signals.indecision         ?? 0) + 1;
    if (obj === "competitor")  signals.competitor_mention = (signals.competitor_mention ?? 0) + 1;
    if (obj === "installment") signals.installment_question = (signals.installment_question ?? 0) + 1;
  }

  // Intent level
  if (classification.intent === "closing") {
    signals.closing_intent = 1;
  } else if (classification.intent === "high") {
    signals.high_intent = 1;
  }

  // Lead capture
  if (leadCaptured) signals.lead_captured = 1;

  // Products recommended this session
  if (productIds.length > 0) {
    signals.product_recommended = Math.min(productIds.length, 5);
  }

  // Keyword-based signals across all user messages
  if (DELIVERY_RE.test(userText))       signals.delivery_question   = 1;
  if (WARRANTY_RE.test(userText))       signals.warranty_question   = 1;
  if (DIMENSIONS_RE.test(userText))     signals.dimensions_request  = 1;
  if (PREMIUM_RE.test(userText))        signals.premium_interest    = 1;
  if (EXPLICIT_INTENT_RE.test(userText)) signals.explicit_intent    = 1;

  // Additional indecision from conversation text
  if (INDECISION_RE.test(userText)) {
    signals.indecision = (signals.indecision ?? 0) + 1;
  }

  // Long conversation (>10 messages)
  if (messages.length > 10) signals.long_conversation = 1;

  // Return after a session where they abandoned
  if (capsuleState && ABANDONMENT_CAPSULE_RE.test(capsuleState.capsule)) {
    signals.return_after_abandonment = 1;
  }

  return signals;
}
