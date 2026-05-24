import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const eventosOperacionaisTable = pgTable("eventos_operacionais", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  lojaId: integer("loja_id").notNull(),
  correlationId: text("correlation_id"),
  requestId: text("request_id"),
  // Domain entity name, e.g. "orcamento", "produto", "usuario"
  entidade: text("entidade").notNull(),
  entidadeId: text("entidade_id"),
  // "created" | "updated" | "deleted" | "viewed" | "exported"
  acao: text("acao").notNull(),
  // ID of the acting user (null for system/agent actions)
  atorId: integer("ator_id"),
  // "usuario" | "agente" | "sistema"
  atorTipo: text("ator_tipo").notNull().default("sistema"),
  // Contextual diff or relevant fields — never store passwords or payment data
  payload: jsonb("payload"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type EventoOperacional = typeof eventosOperacionaisTable.$inferSelect;
