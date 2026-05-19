import type { IntentLevel } from "./types";

const PAIN_PATTERNS: Record<string, RegExp> = {
  lombar: /lombar|costas|coluna/i,
  cervical: /cervical|pescoço|nuca/i,
  calor: /\bcalor\b|suor|quente|esquenta/i,
  pressao: /pressão|formigamento|circulação|dorme o braço/i,
  movimento: /parceiro|mexe muito|acorda|incomoda/i,
  insonia: /insônia|não consigo dormir|sono ruim|acordar/i,
};

const OBJECTION_PATTERNS: Record<string, RegExp> = {
  price: /caro|muito caro|salgado|preço alto|não tenho/i,
  thinking: /vou pensar|deixa eu ver|depois vejo|vou falar com/i,
  competitor: /mais barato|vi por menos|concorrente|outra loja/i,
  installment: /parcelar|parcela|vezes|financiar/i,
};

const HIGH_INTENT_PATTERN =
  /quanto custa|qual o preço|tem entrega|prazo de entrega|condição especial|garanti|parcelamento|à vista|pix/i;

export interface MessageClassification {
  intent: IntentLevel;
  pains: string[];
  objections: string[];
}

export function classifyMessage(text: string): MessageClassification {
  const pains = Object.entries(PAIN_PATTERNS)
    .filter(([, re]) => re.test(text))
    .map(([key]) => key);

  const objections = Object.entries(OBJECTION_PATTERNS)
    .filter(([, re]) => re.test(text))
    .map(([key]) => key);

  let intent: IntentLevel = "low";
  if (HIGH_INTENT_PATTERN.test(text)) intent = "medium";
  if (intent === "medium" && pains.length > 0) intent = "high";

  return { intent, pains, objections };
}

export function extractProductIds(assistantText: string): number[] {
  const matches = [...assistantText.matchAll(/\[ID:(\d+)\]/g)];
  return [...new Set(matches.map((m) => parseInt(m[1], 10)))];
}
