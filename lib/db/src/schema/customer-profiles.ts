import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const customerProfilesTable = pgTable("customer_profiles", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull(),
  anonymousId: text("anonymous_id").notNull(),
  phone: text("phone"),
  name: text("name"),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
}, (t) => [
  unique("customer_profiles_anon_loja_uq").on(t.anonymousId, t.lojaId),
]);

export type CustomerProfile = typeof customerProfilesTable.$inferSelect;
