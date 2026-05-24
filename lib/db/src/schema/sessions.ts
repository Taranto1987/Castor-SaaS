import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  usuarioId: integer("usuario_id").notNull(),
  lojaId: integer("loja_id").notNull(),
  // Full Session object stored for hydration on server restart
  payload: jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type DbSession = typeof sessionsTable.$inferSelect;
