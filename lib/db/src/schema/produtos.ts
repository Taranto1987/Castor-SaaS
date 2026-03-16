import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const produtosTable = pgTable("produtos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  sku: text("sku"),
  preco: text("preco"),
  precoPix: text("preco_pix"),
  parcelamento: text("parcelamento"),
  medidas: text("medidas"),
  altura: text("altura"),
  categoria: text("categoria").notNull(),
  imagem: text("imagem"),
  link: text("link"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export const insertProdutoSchema = createInsertSchema(produtosTable).omit({ id: true, criadoEm: true });
export type InsertProduto = z.infer<typeof insertProdutoSchema>;
export type Produto = typeof produtosTable.$inferSelect;

export const crawlerStatusTable = pgTable("crawler_status", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("idle"),
  mensagem: text("mensagem").notNull().default(""),
  totalProdutos: text("total_produtos").default("0"),
  produtosColetados: text("produtos_coletados").default("0"),
  erros: text("erros").default("0"),
  iniciadoEm: timestamp("iniciado_em"),
  finalizadoEm: timestamp("finalizado_em"),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});
