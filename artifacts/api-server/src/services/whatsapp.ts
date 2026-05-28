import { EvolutionAdapter } from "../providers/evolution.adapter.js";
import { getActiveInstance } from "./whatsapp/instance-manager.js";

const fallbackProvider = new EvolutionAdapter();

export async function enviarWhatsApp(
  numero: string,
  mensagem: string,
  lojaId?: number
): Promise<void> {
  if (lojaId) {
    const instance = await getActiveInstance(lojaId);
    if (instance) {
      const adapter = new EvolutionAdapter({
        baseUrl: process.env.EVOLUTION_API_URL ?? "",
        token: process.env.EVOLUTION_API_KEY ?? "",
        instanceId: instance.instanceId,
      });
      await adapter.sendText(numero, mensagem);
      return;
    }
  }
  await fallbackProvider.sendText(numero, mensagem);
}
