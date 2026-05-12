import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// One-time idempotent backfill: derive slug from legacy link column for products
// crawled before the slug column was added.
//
// Run manually: pnpm --filter @workspace/scripts run backfill-slugs
// Safe to run multiple times — WHERE slug IS NULL guard makes it a no-op once
// all rows are populated.
async function run() {
  console.log("[backfill-slugs] Starting...");

  const result = await db.execute(sql`
    UPDATE produtos
    SET slug = REPLACE(link, 'https://lojacastor.com.br/', '')
    WHERE slug IS NULL
      AND link IS NOT NULL
      AND link LIKE 'https://lojacastor.com.br/%'
  `);

  const updated = (result as { rowCount?: number }).rowCount ?? 0;
  console.log(`[backfill-slugs] Done — ${updated} rows updated.`);
  process.exit(0);
}

run().catch(err => {
  console.error("[backfill-slugs] Fatal:", err);
  process.exit(1);
});
