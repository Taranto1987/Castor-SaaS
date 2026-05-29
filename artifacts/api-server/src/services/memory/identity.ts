import { db, customerProfilesTable, relationalCapsulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Find or create a customer record using their phone number as the primary key.
 * Used by the Mapa do Sono quiz — there's no browser anonymousId in that flow,
 * only the WhatsApp number captured at the end.
 */
export async function resolveOrCreateCustomerByPhone(
  phone: string,
  name: string | null,
  lojaId: number,
): Promise<number> {
  const normalized = phone.replace(/\D/g, "");

  const existing = await db
    .select({ id: customerProfilesTable.id })
    .from(customerProfilesTable)
    .where(
      and(
        eq(customerProfilesTable.phone, normalized),
        eq(customerProfilesTable.lojaId, lojaId),
      )
    )
    .limit(1);

  if (existing[0]) {
    if (name) {
      await db
        .update(customerProfilesTable)
        .set({ name, atualizadoEm: new Date() })
        .where(eq(customerProfilesTable.id, existing[0].id));
    }
    return existing[0].id;
  }

  const [created] = await db
    .insert(customerProfilesTable)
    .values({
      anonymousId: `phone:${normalized}`,
      lojaId,
      phone: normalized,
      ...(name ? { name } : {}),
    })
    .returning({ id: customerProfilesTable.id });

  return created.id;
}

export async function resolveOrCreateCustomer(
  anonymousId: string,
  lojaId: number
): Promise<{ id: number; name: string | null }> {
  const existing = await db
    .select({ id: customerProfilesTable.id, name: customerProfilesTable.name })
    .from(customerProfilesTable)
    .where(
      and(
        eq(customerProfilesTable.anonymousId, anonymousId),
        eq(customerProfilesTable.lojaId, lojaId)
      )
    )
    .limit(1);

  if (existing[0]) return { id: existing[0].id, name: existing[0].name ?? null };

  await db
    .insert(customerProfilesTable)
    .values({ anonymousId, lojaId })
    .onConflictDoNothing();

  const [row] = await db
    .select({ id: customerProfilesTable.id, name: customerProfilesTable.name })
    .from(customerProfilesTable)
    .where(
      and(
        eq(customerProfilesTable.anonymousId, anonymousId),
        eq(customerProfilesTable.lojaId, lojaId)
      )
    )
    .limit(1);

  return { id: row.id, name: row.name ?? null };
}

/**
 * Phone-based identity stitching.
 * When a user provides their phone number:
 * 1. If another profile already owns that phone (prior device/session), copy their capsule
 *    to the current customer so cross-device history is preserved.
 * 2. Update the current profile with phone + name.
 *
 * This enables: "customer returns on a different device, provides phone → remembered."
 */
export async function stitchIdentityByPhone(
  currentCustomerId: number,
  phone: string,
  name: string | null,
  lojaId: number,
): Promise<void> {
  const normalized = phone.replace(/\D/g, "");

  // Find any other profile that already owns this phone
  const canonical = await db
    .select({ id: customerProfilesTable.id })
    .from(customerProfilesTable)
    .where(
      and(
        eq(customerProfilesTable.phone, normalized),
        eq(customerProfilesTable.lojaId, lojaId),
      ),
    )
    .limit(1);

  const canonicalId = canonical[0]?.id ?? null;

  if (canonicalId && canonicalId !== currentCustomerId) {
    // Another profile owns this phone — they may have richer capsule history.
    // Copy their capsule to current profile if current has none.
    const [currentCapsule, canonicalCapsule] = await Promise.all([
      db
        .select({ id: relationalCapsulesTable.id })
        .from(relationalCapsulesTable)
        .where(eq(relationalCapsulesTable.customerId, currentCustomerId))
        .limit(1),
      db
        .select()
        .from(relationalCapsulesTable)
        .where(eq(relationalCapsulesTable.customerId, canonicalId))
        .limit(1),
    ]);

    if (!currentCapsule[0] && canonicalCapsule[0]) {
      await db.insert(relationalCapsulesTable).values({
        customerId: currentCustomerId,
        lojaId,
        capsule: canonicalCapsule[0].capsule,
        sessionCount: canonicalCapsule[0].sessionCount,
        lastContactAt: canonicalCapsule[0].lastContactAt,
      });
      console.log(`[Memory] Capsule stitched from customer ${canonicalId} → ${currentCustomerId} via phone`);
    }
  }

  // Update current profile with phone / name
  await db
    .update(customerProfilesTable)
    .set({
      phone: normalized,
      ...(name ? { name } : {}),
      atualizadoEm: new Date(),
    })
    .where(eq(customerProfilesTable.id, currentCustomerId));
}
