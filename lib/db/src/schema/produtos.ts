import { pgTable, serial, text, timestamp, boolean, integer, numeric, jsonb, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// showroom = disponível em loja, outlet = peça de mostruário/desconto,
// hidden = oculto do catálogo público, seasonal = visível só em período específico
export const salesModeEnum   = pgEnum("sales_mode",         ["showroom", "outlet", "hidden", "seasonal"]);
export const deliveryStrategyEnum = pgEnum("delivery_strategy", ["pronta_entrega", "sob_encomenda"]);

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
  // Outlet pricing engine — separado do preço do crawler.
  // factoryCost = precoBase * (1 - supplier_discount_percent / 100)
  // outletPrice  = factoryCost * (1 + outlet_markup_percent / 100) ou override manual
  factoryCost: numeric("factory_cost", { precision: 12, scale: 2 }),
  outletMarkupPercent: numeric("outlet_markup_percent", { precision: 5, scale: 2 }),
  outletPrice: numeric("outlet_price", { precision: 12, scale: 2 }),
  // Product-family grouping — written by crawler, fallback computed in mapProduto.
  familySlug: text("family_slug"),
  familyName: text("family_name"),
  size: text("size"),
  // Descrição comercial completa do fabricante (HTML sanitizado, preservado p/ PDP/SEO/chat).
  // Antes era buscada no GraphQL só para extrair medidas/altura e descartada.
  descricao: text("descricao"),
  // Ficha técnica normalizada: chave snake_case → valor. Origem: custom_attributes Magento
  // + specs parseadas do HTML da descrição (densidade, altura, mola, biotipo, garantia,
  // ventilação, conforto, ...). O payload Magento bruto fica sob a chave reservada `_raw`
  // (lossless — permite reprocessar sem re-crawl). default {} → nunca null.
  // Regra de promoção: uma chave só vira coluna tipada quando o motor-v2/filtros precisarem indexá-la.
  fichaTecnica: jsonb("ficha_tecnica").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
  // Commercial lifecycle: replaces the boolean disponivel/encomenda flags for UI/filtering.
  salesMode:        salesModeEnum("sales_mode").default("showroom"),
  deliveryStrategy: deliveryStrategyEnum("delivery_strategy").default("pronta_entrega"),
  criadoEm: timestamp("criado_em").defaultNow(),
  // Set to NOW() each time the crawler confirms this product still exists on
  // the supplier catalog. Products not seen after a sync are soft-deleted
  // (disponivel = false) instead of being physically deleted.
  sincronizadoEm: timestamp("sincronizado_em"),
}, (t) => [
  // Composite per-loja: same SKU/slug allowed across different lojas (multi-tenant safe)
  uniqueIndex("produtos_sku_loja_unique").on(t.sku, t.lojaId).where(sql`${t.sku} IS NOT NULL`),
  uniqueIndex("produtos_slug_loja_unique").on(t.slug, t.lojaId).where(sql`${t.slug} IS NOT NULL`),
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
