import { db, customerProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function resolveOrCreateCustomer(
  anonymousId: string,
  lojaId: number
): Promise<number> {
  const existing = await db
    .select({ id: customerProfilesTable.id })
    .from(customerProfilesTable)
    .where(
      and(
        eq(customerProfilesTable.anonymousId, anonymousId),
        eq(customerProfilesTable.lojaId, lojaId)
      )
    )
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(customerProfilesTable)
    .values({ anonymousId, lojaId })
    .returning({ id: customerProfilesTable.id });

  return created.id;
}

export async function mergePhoneIdentity(
  customerId: number,
  phone: string,
  name: string | null
): Promise<void> {
  await db
    .update(customerProfilesTable)
    .set({
      phone,
      ...(name ? { name } : {}),
      atualizadoEm: new Date(),
    })
    .where(eq(customerProfilesTable.id, customerId));
}
