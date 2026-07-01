import { pgTable, serial, integer, text, boolean, timestamp, numeric, uniqueIndex } from "drizzle-orm/pg-core";

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
  // Sync state — updated by the async worker after each sync attempt
  // idle | ok | error | dead
  syncStatus: text("sync_status").notNull().default("idle"),
  ultimoSyncAt: timestamp("ultimo_sync_at"),
  ultimoHash: text("ultimo_hash"),
  ultimoPreco: numeric("ultimo_preco", { precision: 12, scale: 2 }),
  ultimoDisponivel: boolean("ultimo_disponivel"),
  ultimaRespostaMeta: text("ultima_resposta_meta"),
  tentativas: integer("tentativas").notNull().default(0),
  ultimoErro: text("ultimo_erro"),
}, (t) => [
  uniqueIndex("meta_produtos_meta_id_loja_unique").on(t.metaProductId, t.lojaId),
  uniqueIndex("meta_produtos_produto_loja_unique").on(t.produtoId, t.lojaId),
]);

export type MetaCatalogoConfig = typeof metaCatalogoConfigTable.$inferSelect;
export type MetaProduto = typeof metaProdutosTable.$inferSelect;
