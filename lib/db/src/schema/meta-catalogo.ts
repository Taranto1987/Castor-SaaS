import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const metaCatalogoConfigTable = pgTable("meta_catalogo_config", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  catalogId: text("catalog_id").notNull(),
  feedId: text("feed_id"),
  accessToken: text("access_token").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
}, (t) => [
  uniqueIndex("meta_catalogo_config_loja_unique").on(t.lojaId),
]);

export const metaProdutosTable = pgTable("meta_produtos", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  metaProductId: text("meta_product_id").notNull(),
  retailerId: text("retailer_id"),
  produtoId: integer("produto_id").notNull(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").defaultNow(),
}, (t) => [
  uniqueIndex("meta_produtos_meta_id_loja_unique").on(t.metaProductId, t.lojaId),
  uniqueIndex("meta_produtos_produto_loja_unique").on(t.produtoId, t.lojaId),
]);

export type MetaCatalogoConfig = typeof metaCatalogoConfigTable.$inferSelect;
export type MetaProduto = typeof metaProdutosTable.$inferSelect;
