// Known stable Railway URLs — used as fallback when env vars aren't set
const EVOLUTION_FALLBACK_URL = "https://eloquent-laughter-production-a0b7.up.railway.app";
const CASTOR_WEBHOOK_FALLBACK = "https://evolution-api-production-405f.up.railway.app/api/whatsapp/webhook";

const baseUrl = () => process.env.EVOLUTION_API_URL ?? EVOLUTION_FALLBACK_URL;
// AUTHENTICATION_API_KEY is the Evolution API key already present on the service
const apiKey = () =>
  process.env.EVOLUTION_API_KEY ?? process.env.AUTHENTICATION_API_KEY ?? "";

function headers(): Record<string, string> {
  return { "Content-Type": "application/json", "apikey": apiKey() };
}

function assertInstanceName(name: string): void {
  if (!/^castor-[a-z0-9-]+$/.test(name)) {
    throw new Error(`[Evolution] Invalid instanceName: "${name}"`);
  }
}

export async function createInstance(instanceName: string): Promise<void> {
  assertInstanceName(instanceName);
  const res = await fetch(`${baseUrl()}/instance/create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Evolution] createInstance ${res.status}: ${body}`);
  }
}

export async function getQRCode(instanceName: string): Promise<string> {
  assertInstanceName(instanceName);
  const res = await fetch(`${baseUrl()}/instance/connect/${instanceName}`, {
    headers: { "apikey": apiKey() },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Evolution] getQRCode ${res.status}: ${body}`);
  }
  const data = await res.json() as { base64?: string; code?: string };
  return data.base64 ?? data.code ?? "";
}

export async function getConnectionState(instanceName: string): Promise<string> {
  assertInstanceName(instanceName);
  const res = await fetch(`${baseUrl()}/instance/connectionState/${instanceName}`, {
    headers: { "apikey": apiKey() },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return "close";
  const data = await res.json() as { instance?: { state?: string } };
  return data.instance?.state ?? "close";
}

// Graceful logout: disconnects the WhatsApp session but keeps the instance object
// on Evolution for easy reconnection without creating a new instanceId.
export async function logoutInstance(instanceName: string): Promise<void> {
  assertInstanceName(instanceName);
  const res = await fetch(`${baseUrl()}/instance/logout/${instanceName}`, {
    method: "DELETE",
    headers: { "apikey": apiKey() },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`[Evolution] logoutInstance ${res.status}`);
  }
}

export async function deleteInstance(instanceName: string): Promise<void> {
  assertInstanceName(instanceName);
  const res = await fetch(`${baseUrl()}/instance/delete/${instanceName}`, {
    method: "DELETE",
    headers: { "apikey": apiKey() },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`[Evolution] deleteInstance ${res.status}`);
  }
}

export async function fetchInstances(): Promise<string[]> {
  if (!apiKey()) return [];
  const res = await fetch(`${baseUrl()}/instance/fetchInstances`, {
    headers: { apikey: apiKey() },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json() as Array<{ instance?: { instanceName?: string } }>;
  return data.map(d => d.instance?.instanceName ?? "").filter(Boolean);
}

export async function setWebhookForInstance(instanceName: string): Promise<void> {
  assertInstanceName(instanceName);
  const webhookUrl = process.env.PUBLIC_URL
    ? `${process.env.PUBLIC_URL}/api/whatsapp/webhook`
    : CASTOR_WEBHOOK_FALLBACK;
  const webhookSecret =
    process.env.EVOLUTION_WEBHOOK_TOKEN ?? process.env.AUTHENTICATION_API_KEY ?? "";
  const res = await fetch(`${baseUrl()}/webhook/set/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      headers: { apikey: webhookSecret },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Evolution] setWebhook ${res.status}: ${body}`);
  }
}

export async function sendTextViaEvolution(
  instanceName: string,
  to: string,
  text: string
): Promise<void> {
  assertInstanceName(instanceName);
  const res = await fetch(`${baseUrl()}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: to, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Evolution] sendText ${res.status}: ${body}`);
  }
}
