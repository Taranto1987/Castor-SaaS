import { db, whatsappInstancesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { WhatsAppInstance } from "@workspace/db";

export async function getOrCreateInstance(lojaId: number, lojaSlug: string): Promise<WhatsAppInstance> {
  const instanceId = `castor-${lojaSlug}`;

  const existing = await db
    .select()
    .from(whatsappInstancesTable)
    .where(eq(whatsappInstancesTable.lojaId, lojaId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(whatsappInstancesTable)
    .values({ lojaId, instanceId })
    .returning();

  return created;
}

export async function updateStatus(
  instanceId: string,
  status: string,
  phone?: string
): Promise<void> {
  await db
    .update(whatsappInstancesTable)
    .set({
      status,
      ...(phone ? { phone } : {}),
      ...(status === "connected" ? { connectedAt: new Date(), lastSeenAt: new Date() } : {}),
      ...(status === "disconnected" ? { phone: null, connectedAt: null } : {}),
    })
    .where(eq(whatsappInstancesTable.instanceId, instanceId));
}

export async function getActiveInstance(lojaId: number): Promise<WhatsAppInstance | null> {
  const rows = await db
    .select()
    .from(whatsappInstancesTable)
    .where(
      and(
        eq(whatsappInstancesTable.lojaId, lojaId),
        eq(whatsappInstancesTable.status, "connected")
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getInstanceByLojaId(lojaId: number): Promise<WhatsAppInstance | null> {
  const rows = await db
    .select()
    .from(whatsappInstancesTable)
    .where(eq(whatsappInstancesTable.lojaId, lojaId))
    .limit(1);

  return rows[0] ?? null;
}
