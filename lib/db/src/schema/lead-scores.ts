import { pgTable, serial, integer, real, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const leadScoresTable = pgTable("lead_scores", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  lojaId: integer("loja_id").notNull(),
  score: real("score").notNull().default(0),
  category: text("category").notNull().default("frio"),
  signals: jsonb("signals").notNull().default({}),
  trend: text("trend").notNull().default("stable"),
  closingProbability: real("closing_probability").notNull().default(0),
  sessionCount: integer("session_count").notNull().default(0),
  totalMessages: integer("total_messages").notNull().default(0),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
}, (t) => [
  // NOTE: era `unique(...)`, mas a aplicação dessa constraint em produção exigia um
  // prompt interativo do drizzle-kit push (truncate?) que travava TODO o deploy — inclusive
  // a criação de novas tabelas. A unicidade já é garantida na aplicação por persistLeadScore()
  // (upsert por customer_id+loja_id). Mantido como índice composto para o lookup.
  index("lead_scores_customer_loja_idx").on(t.customerId, t.lojaId),
  index("lead_scores_loja_score_idx").on(t.lojaId, t.score),
  index("lead_scores_customer_idx").on(t.customerId),
]);

export type LeadScore = typeof leadScoresTable.$inferSelect;

export const leadScoreHistoryTable = pgTable("lead_score_history", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  lojaId: integer("loja_id").notNull(),
  score: real("score").notNull(),
  category: text("category").notNull(),
  delta: real("delta").notNull().default(0),
  triggerEvent: text("trigger_event"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type LeadScoreHistory = typeof leadScoreHistoryTable.$inferSelect;
