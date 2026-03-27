import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { produtosTable } from "./produtos";

export const entradasEstoqueTable = pgTable("entradas_estoque", {
  id: serial("id").primaryKey(),
  fornecedor: text("fornecedor"),
  imagemNota: text("imagem_nota"),
  totalItens: integer("total_itens").notNull().default(0),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export const itensEntradaEstoqueTable = pgTable("itens_entrada_estoque", {
  id: serial("id").primaryKey(),
  entradaId: integer("entrada_id").notNull().references(() => entradasEstoqueTable.id),
  produtoId: integer("produto_id").references(() => produtosTable.id),
  nomeExtraido: text("nome_extraido").notNull(),
  skuExtraido: text("sku_extraido"),
  quantidade: integer("quantidade").notNull().default(1),
  precoCusto: text("preco_custo"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type EntradaEstoque = typeof entradasEstoqueTable.$inferSelect;
export type ItemEntradaEstoque = typeof itensEntradaEstoqueTable.$inferSelect;
