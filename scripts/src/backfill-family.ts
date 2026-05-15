import { db, extractFamilyInfo } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { isNull, or } from "drizzle-orm";

// Idempotent backfill: populate familySlug / familyName / size for every product
// that hasn't been processed yet. Safe to run multiple times.
//
// Run: pnpm --filter @workspace/scripts tsx ./src/backfill-family.ts
async function run() {
  console.log("[backfill-family] Starting...");

  const rows = await db
    .select({ id: produtosTable.id, slug: produtosTable.slug, nome: produtosTable.nome })
    .from(produtosTable)
    .where(or(isNull(produtosTable.familySlug), isNull(produtosTable.familyName)));

  console.log(`[backfill-family] ${rows.length} products to update.`);

  let updated = 0;
  for (const row of rows) {
    const { familySlug, familyName, size } = extractFamilyInfo(row.slug, row.nome);
    await db
      .update(produtosTable)
      .set({ familySlug, familyName, size })
      .where(isNull(produtosTable.familySlug));
    updated++;
    if (updated % 50 === 0) console.log(`[backfill-family] ${updated}/${rows.length}...`);
  }

  console.log(`[backfill-family] Done — ${updated} rows updated.`);
  process.exit(0);
}

run().catch(err => {
  console.error("[backfill-family] Fatal:", err);
  process.exit(1);
});
