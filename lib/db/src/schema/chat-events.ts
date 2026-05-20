import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const chatEventsTable = pgTable("chat_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  sessionId: text("session_id"),
  lojaId: integer("loja_id"),
  payload: jsonb("payload").notNull().default({}),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type ChatEventRow = typeof chatEventsTable.$inferSelect;
