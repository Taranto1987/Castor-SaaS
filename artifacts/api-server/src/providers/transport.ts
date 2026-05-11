export interface ProviderClient {
  baseUrl: string;
  token: string;
  instanceId: string;
}

export function createProviderClient(): ProviderClient {
  return {
    baseUrl: process.env.WHATSAPP_API_URL ?? "",
    token: process.env.WHATSAPP_API_TOKEN ?? "",
    instanceId: process.env.WHATSAPP_INSTANCE_ID ?? "",
  };
}

export async function providerPost(
  client: ProviderClient,
  path: string,
  body: unknown
): Promise<Response> {
  return fetch(`${client.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": client.token,
    },
    body: JSON.stringify(body),
  });
}

export async function providerGet(
  client: ProviderClient,
  path: string
): Promise<Response> {
  return fetch(`${client.baseUrl}${path}`, {
    headers: { "apikey": client.token },
  });
}
