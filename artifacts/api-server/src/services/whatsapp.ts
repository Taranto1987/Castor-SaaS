import { createWhatsAppProvider } from "../providers/whatsapp-provider.js";

const provider = createWhatsAppProvider();

export async function enviarWhatsApp(numero: string, mensagem: string): Promise<void> {
  await provider.sendText(numero, mensagem);
}
