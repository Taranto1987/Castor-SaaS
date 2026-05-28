const baseUrl = () => process.env.EVOLUTION_API_URL ?? "";
const apiKey = () => process.env.EVOLUTION_API_KEY ?? "";

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
