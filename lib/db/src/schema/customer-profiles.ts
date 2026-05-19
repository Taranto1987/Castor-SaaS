import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const customerProfilesTable = pgTable("customer_profiles", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  anonymousId: text("anonymous_id").notNull().unique(),
  phone: text("phone"),
  name: text("name"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type CustomerProfile = typeof customerProfilesTable.$inferSelect;
