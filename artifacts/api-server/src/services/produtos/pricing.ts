import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getPricingConfig, calcOutletPrice } from "../../routes/loja";
import type { PricingConfig } from "../../routes/loja";

export type { PricingConfig };
export { calcOutletPrice };

export async function getLojaPricing(lojaId: number): Promise<PricingConfig> {
  const rows = await db
    .select({ configJson: lojasTable.configJson })
    .from(lojasTable)
    .where(eq(lojasTable.id, lojaId))
    .limit(1);
  return getPricingConfig(rows[0]?.configJson);
}
