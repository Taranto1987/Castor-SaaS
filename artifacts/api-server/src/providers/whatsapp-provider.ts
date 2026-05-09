import { EvolutionAdapter } from "./evolution.adapter.js";

export interface SessionInfo {
  connected: boolean;
  instanceId: string;
}

export interface WhatsAppProvider {
  sendText(to: string, text: string): Promise<void>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<void>;
  sendAudio(to: string, audioUrl: string): Promise<void>;
  getSession(): Promise<SessionInfo>;
  webhook(payload: unknown): void;
}

export function createWhatsAppProvider(): WhatsAppProvider {
  const providerName = process.env.WHATSAPP_PROVIDER ?? "evolution";

  if (providerName === "evolution") {
    return new EvolutionAdapter();
  }

  throw new Error(`[WhatsApp] Unknown provider: "${providerName}". Supported: evolution`);
}
