import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";

export const toolExecutionsTable = pgTable("tool_executions", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  toolName: text("tool_name").notNull(),
  source: text("source").notNull().default("chat"), // "chat" | "mcp"
  status: text("status").notNull(),                 // "success" | "error" | "timeout"
  durationMs: integer("duration_ms").notNull(),
  inputSummary: jsonb("input_summary"),             // input params only — no output (may be large)
  errorMessage: text("error_message"),
  correlationId: text("correlation_id"),
  requestId: text("request_id"),
  criadoEm: timestamp("criado_em").defaultNow(),
}, (t) => [
  index("tool_executions_loja_created_idx").on(t.lojaId, t.criadoEm),
  index("tool_executions_correlation_idx").on(t.correlationId).where(isNotNull(t.correlationId)),
]);

export type ToolExecution = typeof toolExecutionsTable.$inferSelect;
