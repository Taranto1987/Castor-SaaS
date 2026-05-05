import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { capiEventsTable } from "@workspace/db/schema";

const META_GRAPH_API = "https://graph.facebook.com/v20.0";

export function isCapiConfigured(): boolean {
  return !!(process.env.META_PIXEL_ID && process.env.META_ADS_ACCESS_TOKEN);
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function hashUserData(phone?: string, name?: string): Record<string, string> {
  const userData: Record<string, string> = {};
  if (phone) userData["ph"] = sha256(normalizePhone(phone));
  if (name) {
    const parts = name.trim().toLowerCase().split(/\s+/);
    userData["fn"] = sha256(parts[0]);
    if (parts.length > 1) userData["ln"] = sha256(parts[parts.length - 1]);
  }
  return userData;
}

async function sendCapiPayload(
  eventName: string,
  userData: Record<string, string>,
  customData: Record<string, any>,
  eventId: string,
): Promise<any> {
  const pixelId = process.env.META_PIXEL_ID!;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN!;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        user_data: userData,
        custom_data: customData,
      },
    ],
  };

  const res = await fetch(`${META_GRAPH_API}/${pixelId}/events?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`CAPI ${eventName} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

export interface LeadEventData {
  phone?: string;
  name?: string;
  leadScore?: number;
  valueEstimated?: number;
}

export async function sendLeadEvent(data: LeadEventData): Promise<void> {
  if (!isCapiConfigured()) return;

  const eventId = `lead_wha_${Date.now()}`;
  const pixelId = process.env.META_PIXEL_ID!;

  const [row] = await db
    .insert(capiEventsTable)
    .values({
      eventName: "Lead",
      pixelId,
      leadPhone: data.phone,
      leadName: data.name,
      leadScore: data.leadScore?.toString(),
      valueEstimated: data.valueEstimated?.toString(),
      eventId,
      status: "pending",
    })
    .returning();

  try {
    const userData = hashUserData(data.phone, data.name);
    const customData: Record<string, any> = {
      lead_type: "whatsapp",
      currency: "BRL",
    };
    if (data.valueEstimated) customData["value"] = data.valueEstimated;
    if (data.leadScore) customData["lead_score"] = data.leadScore;

    const metaResponse = await sendCapiPayload("Lead", userData, customData, eventId);

    await db
      .update(capiEventsTable)
      .set({ status: "sent", metaResponse, sentAt: new Date() })
      .where(eq(capiEventsTable.id, row.id));

    console.log(`[CAPI] Lead enviado: ${data.phone} score=${data.leadScore}`);
  } catch (e: any) {
    await db
      .update(capiEventsTable)
      .set({ status: "error", errorMessage: e.message })
      .where(eq(capiEventsTable.id, row.id));

    console.error("[CAPI] Erro ao enviar Lead:", e.message);
  }
}

export interface PurchaseEventData {
  phone?: string;
  name?: string;
  value: number;
  orderId?: string;
}

export async function sendPurchaseEvent(data: PurchaseEventData): Promise<void> {
  if (!isCapiConfigured()) return;

  const eventId = data.orderId ? `purchase_${data.orderId}` : `purchase_${Date.now()}`;
  const pixelId = process.env.META_PIXEL_ID!;

  const [row] = await db
    .insert(capiEventsTable)
    .values({
      eventName: "Purchase",
      pixelId,
      leadPhone: data.phone,
      leadName: data.name,
      valueEstimated: data.value.toString(),
      eventId,
      status: "pending",
    })
    .returning();

  try {
    const userData = hashUserData(data.phone, data.name);
    const customData = {
      value: data.value,
      currency: "BRL",
      contents: [{ id: "colchao", quantity: 1 }],
      content_type: "product",
    };

    const metaResponse = await sendCapiPayload("Purchase", userData, customData, eventId);

    await db
      .update(capiEventsTable)
      .set({ status: "sent", metaResponse, sentAt: new Date() })
      .where(eq(capiEventsTable.id, row.id));

    console.log(`[CAPI] Purchase enviado: R$${data.value} — ${data.phone}`);
  } catch (e: any) {
    await db
      .update(capiEventsTable)
      .set({ status: "error", errorMessage: e.message })
      .where(eq(capiEventsTable.id, row.id));

    console.error("[CAPI] Erro ao enviar Purchase:", e.message);
  }
}
