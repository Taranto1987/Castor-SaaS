export type LeadCategory =
  | "frio"
  | "curioso"
  | "interessado"
  | "quente"
  | "muito_quente"
  | "alta_probabilidade_fechamento";

export type SignalKey =
  // Positive — engagement & intent
  | "session_return"
  | "pain_detected"
  | "delivery_question"
  | "installment_question"
  | "premium_interest"
  | "dimensions_request"
  | "long_conversation"
  | "return_after_abandonment"
  | "warranty_question"
  | "explicit_intent"
  | "high_intent"
  | "closing_intent"
  | "product_recommended"
  | "lead_captured"
  // Negative — friction & resistance
  | "price_objection"
  | "competitor_mention"
  | "abandonment"
  | "indecision";

export type StoredSignals = Partial<Record<SignalKey, number>>;

export interface Weight {
  points: number;
  label: string;
  maxApplications: number;
}

export const SCORE_WEIGHTS: Record<SignalKey, Weight> = {
  session_return:           { points: 15, label: "Retornou ao site",               maxApplications: 4 },
  pain_detected:            { points: 10, label: "Mencionou dor/desconforto",       maxApplications: 3 },
  delivery_question:        { points: 12, label: "Perguntou sobre entrega",         maxApplications: 2 },
  installment_question:     { points: 10, label: "Perguntou sobre parcelamento",    maxApplications: 2 },
  premium_interest:         { points: 15, label: "Interesse em produto premium",    maxApplications: 2 },
  dimensions_request:       { points: 10, label: "Pediu medidas/tamanho",           maxApplications: 2 },
  long_conversation:        { points:  8, label: "Conversa longa (>10 mensagens)",  maxApplications: 2 },
  return_after_abandonment: { points: 20, label: "Retornou após abandono",          maxApplications: 2 },
  warranty_question:        { points: 10, label: "Perguntou sobre garantia",        maxApplications: 1 },
  explicit_intent:          { points: 25, label: "Intenção explícita de compra",    maxApplications: 1 },
  high_intent:              { points: 15, label: "Alta intenção detectada",         maxApplications: 3 },
  closing_intent:           { points: 30, label: "Intenção de fechamento",          maxApplications: 2 },
  product_recommended:      { points:  5, label: "Produto recomendado",             maxApplications: 5 },
  lead_captured:            { points: 20, label: "Lead capturado (contato)",        maxApplications: 1 },
  price_objection:          { points: -8, label: "Objeção de preço",               maxApplications: 3 },
  competitor_mention:       { points: -5, label: "Mencionou concorrente",           maxApplications: 2 },
  abandonment:              { points:-10, label: "Abandono detectado",              maxApplications: 3 },
  indecision:               { points: -5, label: "Sinal de indecisão",             maxApplications: 3 },
};

export interface CategoryMeta {
  category: LeadCategory;
  minScore: number;
  label: string;
  description: string;
  color: string;
}

export const CATEGORY_THRESHOLDS: CategoryMeta[] = [
  { category: "alta_probabilidade_fechamento", minScore: 85, label: "Alta Probabilidade de Fechamento", description: "Pronto para comprar — abordar com oferta direta",          color: "#16a34a" },
  { category: "muito_quente",                  minScore: 70, label: "Muito Quente",                     description: "Alta intenção — follow-up imediato recomendado",           color: "#dc2626" },
  { category: "quente",                        minScore: 55, label: "Quente",                           description: "Considerando seriamente — nutrir com informação",           color: "#ea580c" },
  { category: "interessado",                   minScore: 35, label: "Interessado",                      description: "Engajado — continuar construindo relacionamento",            color: "#ca8a04" },
  { category: "curioso",                       minScore: 15, label: "Curioso",                          description: "Explorando — despertar necessidade",                        color: "#2563eb" },
  { category: "frio",                          minScore:  0, label: "Frio",                             description: "Início do funil — qualificar intenção",                     color: "#6b7280" },
];

export function getCategoryMeta(category: LeadCategory): CategoryMeta {
  return CATEGORY_THRESHOLDS.find((c) => c.category === category) ?? CATEGORY_THRESHOLDS[5];
}
