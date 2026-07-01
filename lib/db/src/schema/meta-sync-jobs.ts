import { pgTable, serial, integer, text, boolean, timestamp, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";

// One row per (produto_id, loja_id) — represents current queue state for that product.
// Status lifecycle: pending → processing → done | failed → (retry: pending) | dead
export const metaSyncJobsTable = pgTable("meta_sync_jobs", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  produtoId: integer("produto_id").notNull(),
  metaProductId: text("meta_product_id"),
  prioridade: integer("prioridade").notNull().default(0),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  // pending | processing | done | failed | dead
  status: text("status").notNull().default("pending"),
  error: text("error"),
  traceId: text("trace_id"),
  scheduledAt: timestamp("scheduled_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (t) => [
  uniqueIndex("meta_sync_jobs_produto_loja_uq").on(t.produtoId, t.lojaId),
  index("meta_sync_jobs_status_sched_idx").on(t.status, t.scheduledAt),
  index("meta_sync_jobs_loja_status_idx").on(t.lojaId, t.status),
]);

// Append-only audit trail — one row per sync attempt regardless of outcome
export const metaSyncAuditTable = pgTable("meta_sync_audit", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  produtoId: integer("produto_id").notNull(),
  metaProductId: text("meta_product_id"),
  precoNovo: numeric("preco_novo", { precision: 12, scale: 2 }),
  disponivelNovo: boolean("disponivel_novo"),
  // ok | error | skipped | circuit_open | rate_limited | dead
  resultado: text("resultado").notNull(),
  duracaoMs: integer("duracao_ms"),
  traceId: text("trace_id"),
  erro: text("erro"),
  respostaMeta: text("resposta_meta"),
  criadoEm: timestamp("criado_em").defaultNow(),
}, (t) => [
  index("meta_sync_audit_loja_criado_idx").on(t.lojaId, t.criadoEm),
  index("meta_sync_audit_produto_idx").on(t.produtoId),
]);

export type MetaSyncJob = typeof metaSyncJobsTable.$inferSelect;
export type MetaSyncAuditEntry = typeof metaSyncAuditTable.$inferSelect;
