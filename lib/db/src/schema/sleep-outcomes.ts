import { pgTable, serial, integer, boolean, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const sleepOutcomesTable = pgTable("sleep_outcomes", {
  id:            serial("id").primaryKey(),
  diagnosticoId: integer("diagnostico_id").notNull(),
  customerId:    integer("customer_id"),
  lojaId:        integer("loja_id").default(1),

  // Registered by Thalles after the sale (or lack thereof)
  vendeu:           boolean("vendeu"),
  produto_vendido:  text("produto_vendido"),
  ticket:           numeric("ticket", { precision: 12, scale: 2 }),
  registradoEm:     timestamp("registrado_em"),

  // 30-day check-in (WA follow-up)
  satisfacao_30d:   integer("satisfacao_30d"),  // 1–5

  // 90-day check-in
  satisfacao_90d:   integer("satisfacao_90d"),  // 1–5
  dor_melhorou:     boolean("dor_melhorou"),

  // 180-day check-in
  satisfacao_180d:  integer("satisfacao_180d"), // 1–5

  // 365-day check-in
  satisfacao_365d:  integer("satisfacao_365d"), // 1–5
  indicou:          boolean("indicou"),
  nps:              integer("nps"),              // 0–10
  trocou:           boolean("trocou"),
  motivo_troca:     text("motivo_troca"),

  // Calculated by Calibration Engine when enough checkpoints are filled
  sleep_success_score: numeric("sleep_success_score", { precision: 5, scale: 2 }),

  criadoEm:    timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type SleepOutcomeRow    = typeof sleepOutcomesTable.$inferSelect;
export type SleepOutcomeInsert = typeof sleepOutcomesTable.$inferInsert;
