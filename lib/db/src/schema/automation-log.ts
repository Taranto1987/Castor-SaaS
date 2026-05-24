import { pgTable, serial, integer, real, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const automationLogTable = pgTable("automation_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  lojaId: integer("loja_id").notNull(),
  ruleId: text("rule_id").notNull(),
  score: real("score"),
  category: text("category"),
  channel: text("channel").notNull().default("whatsapp"),
  destination: text("destination"),
  payload: jsonb("payload").notNull().default({}),
  dispararadoEm: timestamp("disparado_em").defaultNow(),
});

export type AutomationLog = typeof automationLogTable.$inferSelect;
