import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { ProductSize } from "../utils/normalizeSize";

/**
 * Castor Core — canonical product family catalog.
 *
 * This table is the authoritative source for the frontend catalog.
 * The crawler's job is to match products to families (by familySlug)
 * and update prices / availability, never to define the catalog structure.
 *
 * Families are brand-global (not per-loja). Prices and availability
 * from produtosTable are filtered by lojaId at query time.
 */
export const productFamiliesTable = pgTable("product_families", {
  // Canonical slug — used as FK target from produtos.family_slug
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  // Override image (not from crawler). Falls back to crawler image when null.
  imageUrl: text("image_url"),
  // Lower number = displayed first within category
  ranking: integer("ranking").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  // Sizes this family offers. Variants without a matching produto show as unavailable.
  availableSizes: jsonb("available_sizes")
    .$type<ProductSize[]>()
    .notNull()
    .default(sql`'["Solteiro","Casal","Queen","King"]'::jsonb`),
  // Biomechanical attributes — filled manually by Thalles after field validation.
  // Used by recommendation motor in Fase 5.
  // Schema: { pressure_relief, lumbar_support, thermal_dissipation, couple_isolation,
  //           adaptation_friendliness, durability_score, edge_support } (0–10 each)
  semanticTags: jsonb("semantic_tags").$type<Record<string, number>>().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductFamilySchema = createInsertSchema(productFamiliesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertProductFamily = z.infer<typeof insertProductFamilySchema>;
export type ProductFamily = typeof productFamiliesTable.$inferSelect;
