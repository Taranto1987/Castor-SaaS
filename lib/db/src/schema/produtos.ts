import { pgTable, serial, text, timestamp, boolean, integer, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const produtosTable = pgTable("produtos", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
  nome: text("nome").notNull(),
  sku: text("sku"),
  slug: text("slug"),
  preco: text("preco"),
  precoPix: text("preco_pix"),
  parcelamento: text("parcelamento"),
  medidas: text("medidas"),
  altura: text("altura"),
  categoria: text("categoria").notNull(),
  imagem: text("imagem"),
  link: text("link"),
  disponivel: boolean("disponivel").notNull().default(true),
  encomenda: boolean("encomenda").notNull().default(false),
  custoBRL: text("custo_brl"),
  prazoEncomenda: text("prazo_encomenda"),
  estoque: integer("estoque"),
  // Preço cheio: referência obrigatória para todo cálculo de desconto.
  // Nunca calcular desconto sobre precoPix ou qualquer preço já reduzido.
  precoBase: numeric("preco_base", { precision: 12, scale: 2 }),
  // Product-family grouping — written by crawler, fallback computed in mapProduto.
  familySlug: text("family_slug"),
  familyName: text("family_name"),
  size: text("size"),
  criadoEm: timestamp("criado_em").defaultNow(),
  // Set to NOW() each time the crawler confirms this product still exists on
  // the supplier catalog. Products not seen after a sync are soft-deleted
  // (disponivel = false) instead of being physically deleted.
  sincronizadoEm: timestamp("sincronizado_em"),
}, (t) => [
  uniqueIndex("produtos_sku_unique").on(t.sku).where(sql`${t.sku} IS NOT NULL`),
  uniqueIndex("produtos_slug_unique").on(t.slug).where(sql`${t.slug} IS NOT NULL`),
]);

export const insertProdutoSchema = createInsertSchema(produtosTable).omit({ id: true, criadoEm: true });
export type InsertProduto = z.infer<typeof insertProdutoSchema>;
export type Produto = typeof produtosTable.$inferSelect;

export const outletInteressesTable = pgTable("outlet_interesses", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
  produtoId: integer("produto_id").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export const crawlerStatusTable = pgTable("crawler_status", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").default(1),
  status: text("status").notNull().default("idle"),
  mensagem: text("mensagem").notNull().default(""),
  totalProdutos: text("total_produtos").default("0"),
  produtosColetados: text("produtos_coletados").default("0"),
  erros: text("erros").default("0"),
  iniciadoEm: timestamp("iniciado_em"),
  finalizadoEm: timestamp("finalizado_em"),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});
