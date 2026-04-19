const ZAPI_INSTANCE = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;

export async function enviarWhatsApp(
  numero: string,
  mensagem: string
): Promise<void> {
  if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
    // Sem credenciais configuradas — loga localmente para dev
    console.log(`[WhatsApp] → ${numero}: ${mensagem}`);
    return;
  }

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: numero, message: mensagem }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[WhatsApp] Erro ao enviar para ${numero}: ${err}`);
  }
}
