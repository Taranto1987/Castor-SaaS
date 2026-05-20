import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const relationalCapsulesTable = pgTable("relational_capsules", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().unique(),
  lojaId: integer("loja_id").notNull(),
  capsule: text("capsule").notNull(),
  sessionCount: integer("session_count").notNull().default(1),
  lastContactAt: timestamp("last_contact_at").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type RelationalCapsule = typeof relationalCapsulesTable.$inferSelect;
