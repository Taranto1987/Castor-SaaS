import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// One-time idempotent backfill: derive slug from legacy link column for products
// that were crawled before the slug column was added.
// Safe to run on every startup — the WHERE slug IS NULL guard makes it a no-op
// once all rows are populated.
export async function backfillSlugs(): Promise<void> {
  const result = await db.execute(sql`
    UPDATE produtos
    SET slug = REPLACE(link, 'https://lojacastor.com.br/', '')
    WHERE slug IS NULL
      AND link IS NOT NULL
      AND link LIKE 'https://lojacastor.com.br/%'
  `);
  const updated = (result as { rowCount?: number }).rowCount ?? 0;
  if (updated > 0) {
    console.log(`[backfill] Populated slug for ${updated} existing products`);
  }
}
