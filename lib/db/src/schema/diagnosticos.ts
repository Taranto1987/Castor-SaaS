import { pgTable, serial, text, integer, jsonb, numeric, timestamp } from "drizzle-orm/pg-core";

export const diagnosticosTable = pgTable("diagnosticos", {
  id:                  serial("id").primaryKey(),
  lojaId:              integer("loja_id").default(1),
  // FK para customer_profiles — resolvido por telefone/WhatsApp na criação
  customerId:          integer("customer_id"),
  leadId:              integer("lead_id"),
  nome:                text("nome"),
  whatsapp:            text("whatsapp"),
  produto_recomendado: text("produto_recomendado"),
  confianca:           numeric("confianca", { precision: 4, scale: 2 }),
  flag_calibracao:     text("flag_calibracao"),
  // Raw quiz answers from the frontend
  respostas:           jsonb("respostas").notNull().default({}),
  // Mapa do Sono 2.0: ResultadoCompatibilidade completo (ranking Top 3 + firmeza + resumo)
  resultado:           jsonb("resultado"),
  // Full biomechanical analysis output (suporte, firmeza, tecnologia, drift, etc.)
  perfil_biomecanico:  jsonb("perfil_biomecanico").notNull().default({}),
  // Behavioral signals: tempo por step, step de abandono, retornos
  perfil_comportamental: jsonb("perfil_comportamental").notNull().default({}),
  criadoEm:            timestamp("criado_em").defaultNow(),
});

export type DiagnosticoRow    = typeof diagnosticosTable.$inferSelect;
export type DiagnosticoInsert = typeof diagnosticosTable.$inferInsert;

