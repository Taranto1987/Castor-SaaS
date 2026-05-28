import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { lojasTable } from "./lojas";

export const whatsappInstancesTable = pgTable("whatsapp_instances", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull().references(() => lojasTable.id),
  instanceId: text("instance_id").notNull().unique(),
  provider: text("provider").notNull().default("evolution"),
  status: text("status").notNull().default("disconnected"),
  // disconnected | awaiting_qr | connected | expired | reconnect_required
  phone: text("phone"),
  connectedAt: timestamp("connected_at"),
  lastSeenAt: timestamp("last_seen_at"),
  sessionMetadata: jsonb("session_metadata"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type WhatsAppInstance = typeof whatsappInstancesTable.$inferSelect;
