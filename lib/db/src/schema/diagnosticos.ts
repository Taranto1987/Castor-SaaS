import { pgTable, serial, text, integer, jsonb, numeric, timestamp } from "drizzle-orm/pg-core";

export const diagnosticosTable = pgTable("diagnosticos", {
  id:                  serial("id").primaryKey(),
  lojaId:              integer("loja_id").default(1),
  nome:                text("nome"),
  whatsapp:            text("whatsapp"),
  produto_recomendado: text("produto_recomendado"),
  confianca:           numeric("confianca", { precision: 4, scale: 2 }),
  flag_calibracao:     text("flag_calibracao"),
  // Raw quiz answers from the frontend
  respostas:           jsonb("respostas").notNull().default({}),
  // Full biomechanical analysis output (suporte, firmeza, tecnologia, drift, etc.)
  perfil_biomecanico:  jsonb("perfil_biomecanico").notNull().default({}),
  criadoEm:            timestamp("criado_em").defaultNow(),
});

export type DiagnosticoRow    = typeof diagnosticosTable.$inferSelect;
export type DiagnosticoInsert = typeof diagnosticosTable.$inferInsert;
