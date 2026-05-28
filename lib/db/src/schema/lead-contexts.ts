import { pgTable, serial, integer, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export const leadContextsTable = pgTable("lead_contexts", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  telefone: text("telefone").notNull(),
  nome: text("nome"),
  ultimoInteresse: text("ultimo_interesse"),
  ultimaCategoria: text("ultima_categoria"),
  ultimoOrcamentoId: integer("ultimo_orcamento_id"),
  faixaPreco: text("faixa_preco"),
  tags: jsonb("tags").$type<string[]>(),
  temperatura: text("temperatura"),
  ultimoContatoEm: timestamp("ultimo_contato_em"),
  ultimoResumoIA: text("ultimo_resumo_ia"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
}, (t) => [unique("lead_ctx_tenant_phone").on(t.telefone, t.lojaId)]);

export type LeadContext = typeof leadContextsTable.$inferSelect;
