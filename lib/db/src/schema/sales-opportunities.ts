import { pgTable, serial, text, timestamp, integer, real, uniqueIndex, index } from "drizzle-orm/pg-core";

/**
 * sales_opportunities — the COCA aggregate.
 *
 * This is the ONLY new table the COCA layer introduces. It does NOT duplicate
 * existing domains; it unifies them into a single actionable pipeline row:
 *
 *   orcamento (the deal)  +  customer_profile (identity → lead_scores)
 *   +  diagnostico (biomechanical fit, optional)  →  one opportunity.
 *
 * Score / closingProbability are CACHED here from `lead_scores` (keyed by
 * customerId) so the Central de Operações can order "Ação Agora" by score DESC
 * without a join. Events live in `eventos_operacionais`; follow-ups in
 * `follow_ups`; sleep profile in `diagnosticos` — all reused, never duplicated.
 */
export const salesOpportunitiesTable = pgTable("sales_opportunities", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),

  // Links to existing domains (integer FKs — consistent with the rest of the schema)
  orcamentoId: integer("orcamento_id").notNull(),
  customerId: integer("customer_id"),
  leadId: integer("lead_id"),
  diagnosticoId: integer("diagnostico_id"),

  // Denormalized for fast display in the operations board
  cliente: text("cliente").notNull(),
  whatsapp: text("whatsapp"),

  // Pipeline state
  // NOVO | ORCAMENTO_ENVIADO | AGUARDANDO_RESPOSTA | NEGOCIANDO | QUENTE |
  // CRITICO | INTERVENCAO_HUMANA | GANHO | PERDIDO | REATIVACAO
  status: text("status").notNull().default("NOVO"),

  // Cached from lead_scores (services/scoring) — source of truth stays there
  score: real("score").notNull().default(0),
  closingProbability: real("closing_probability").notNull().default(0),

  // Deal value (numeric for sums/ordering + formatted text for display)
  valorNumerico: real("valor_numerico").notNull().default(0),
  valorBrl: text("valor_brl"),

  // Cadence / next best action
  diasSemResposta: integer("dias_sem_resposta").notNull().default(0),
  proximaAcao: text("proxima_acao"),
  motivo: text("motivo"),
  responsavel: text("responsavel"),

  ultimoContatoEm: timestamp("ultimo_contato_em"),
  proximoContatoEm: timestamp("proximo_contato_em"),

  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
}, (t) => [
  // One opportunity per orçamento per loja (idempotent creation)
  uniqueIndex("sales_opp_loja_orcamento_uq").on(t.lojaId, t.orcamentoId),
  // Fast "Ação Agora" ordering
  index("sales_opp_loja_status_score_idx").on(t.lojaId, t.status, t.score),
]);

export type SalesOpportunity = typeof salesOpportunitiesTable.$inferSelect;
export type NewSalesOpportunity = typeof salesOpportunitiesTable.$inferInsert;
