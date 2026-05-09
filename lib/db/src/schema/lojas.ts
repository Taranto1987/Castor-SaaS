import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const lojasTable = pgTable("lojas", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  operacao: text("operacao").notNull(),
  responsavel: text("responsavel"),
  whatsappNumero: text("whatsapp_numero"),
  whatsappDisplay: text("whatsapp_display"),
  cidadesJson: jsonb("cidades_json"),
  endereco: text("endereco"),
  cidade: text("cidade"),
  promptDelta: text("prompt_delta"),
  configJson: jsonb("config_json"),
  ativa: boolean("ativa").notNull().default(true),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type Loja = typeof lojasTable.$inferSelect;
