import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";

export const despesasTable = pgTable("despesas", {
  id: serial("id").primaryKey(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  categoria: text("categoria").notNull(),
  descricao: text("descricao"),
  comprovante: text("comprovante"),
  recorrente: boolean("recorrente").notNull().default(false),
  recorrenteId: integer("recorrente_id"),
  confirmada: boolean("confirmada").notNull().default(true),
  data: timestamp("data").notNull().defaultNow(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type Despesa = typeof despesasTable.$inferSelect;

export const despesasRecorrentesTable = pgTable("despesas_recorrentes", {
  id: serial("id").primaryKey(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  categoria: text("categoria").notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  diaVencimento: integer("dia_vencimento").notNull().default(1),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type DespesaRecorrente = typeof despesasRecorrentesTable.$inferSelect;

export const comissoesConfigTable = pgTable("comissoes_config", {
  id: serial("id").primaryKey(),
  vendedor: text("vendedor").notNull().unique(),
  percentual: numeric("percentual", { precision: 5, scale: 2 }).notNull().default("2.00"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type ComissaoConfig = typeof comissoesConfigTable.$inferSelect;

export const metasTable = pgTable("metas", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  operacao: text("operacao").notNull().default("cabo_frio"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type Meta = typeof metasTable.$inferSelect;
