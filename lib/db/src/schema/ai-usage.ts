import { pgTable, bigserial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { lojasTable } from "./lojas";

export const aiUsageTable = pgTable("ai_usage", {
  id:             bigserial("id", { mode: "number" }).primaryKey(),
  lojaId:         integer("loja_id").notNull().references(() => lojasTable.id),
  modelo:         text("modelo").notNull(),
  inputTokens:    integer("input_tokens").notNull().default(0),
  outputTokens:   integer("output_tokens").notNull().default(0),
  cacheTokens:    integer("cache_tokens").notNull().default(0),
  custoEstimado:  numeric("custo_estimado", { precision: 10, scale: 6 }),
  contexto:       text("contexto"),   // 'chat' | 'waha' | 'capsule' | 'lead' | 'lead-context'
  requestId:      text("request_id"),
  criadoEm:       timestamp("criado_em").defaultNow(),
});

export type AiUsage = typeof aiUsageTable.$inferSelect;
