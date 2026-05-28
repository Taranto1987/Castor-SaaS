import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { produtosTable } from "./produtos";

export const entradasEstoqueTable = pgTable("entradas_estoque", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
  fornecedor: text("fornecedor"),
  imagemNota: text("imagem_nota"),
  numeroNF: text("numero_nf"),
  cnpjFornecedor: text("cnpj_fornecedor"),
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
  custoUnitario: numeric("custo_unitario", { precision: 12, scale: 2 }),
  markupPercent: numeric("markup_percent", { precision: 5, scale: 2 }),
  precoSugerido: numeric("preco_sugerido", { precision: 12, scale: 2 }),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type EntradaEstoque = typeof entradasEstoqueTable.$inferSelect;
export type ItemEntradaEstoque = typeof itensEntradaEstoqueTable.$inferSelect;
