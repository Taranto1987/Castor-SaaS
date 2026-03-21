import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const entregasTable = pgTable("entregas", {
  id: serial("id").primaryKey(),
  orcamentoId: integer("orcamento_id"),
  cliente: text("cliente").notNull(),
  whatsapp: text("whatsapp"),
  endereco: text("endereco"),
  produtos: text("produtos"),
  status: text("status").notNull().default("pendente"),
  vendedor: text("vendedor"),
  observacoes: text("observacoes"),
  dataEntrega: text("data_entrega"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type Entrega = typeof entregasTable.$inferSelect;
