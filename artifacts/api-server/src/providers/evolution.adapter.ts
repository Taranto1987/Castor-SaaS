import type { WhatsAppProvider, SessionInfo } from "./whatsapp-provider.js";
import { createProviderClient, providerPost, providerGet, type ProviderClient } from "./transport.js";

export class EvolutionAdapter implements WhatsAppProvider {
  private readonly client: ProviderClient;

  constructor(client?: ProviderClient) {
    this.client = client ?? createProviderClient();
  }

  private get ready(): boolean {
    return !!(this.client.baseUrl && this.client.token && this.client.instanceId);
  }

  async sendText(to: string, text: string): Promise<void> {
    if (!this.ready) {
      console.log(`[WhatsApp] → ${to}: ${text}`);
      return;
    }
    const res = await providerPost(
      this.client,
      `/message/sendText/${this.client.instanceId}`,
      { number: to, text }
    );
    if (!res.ok) {
      console.error(`[WhatsApp] sendText error (${res.status}): ${await res.text()}`);
    }
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    if (!this.ready) return;
    const res = await providerPost(
      this.client,
      `/message/sendMedia/${this.client.instanceId}`,
      { number: to, mediatype: "image", mediaUrl: imageUrl, caption: caption ?? "" }
    );
    if (!res.ok) {
      console.error(`[WhatsApp] sendImage error (${res.status}): ${await res.text()}`);
    }
  }

  async sendAudio(to: string, audioUrl: string): Promise<void> {
    if (!this.ready) return;
    const res = await providerPost(
      this.client,
      `/message/sendMedia/${this.client.instanceId}`,
      { number: to, mediatype: "audio", mediaUrl: audioUrl }
    );
    if (!res.ok) {
      console.error(`[WhatsApp] sendAudio error (${res.status}): ${await res.text()}`);
    }
  }

  async getSession(): Promise<SessionInfo> {
    if (!this.ready) {
      return { connected: false, instanceId: this.client.instanceId };
    }
    try {
      const res = await providerGet(
        this.client,
        `/instance/connectionState/${this.client.instanceId}`
      );
      const data = await res.json() as { instance?: { state?: string } };
      return {
        connected: data?.instance?.state === "open",
        instanceId: this.client.instanceId,
      };
    } catch {
      return { connected: false, instanceId: this.client.instanceId };
    }
  }

  webhook(_payload: unknown): void {
    // Evolution webhook payload processing — extend per feature
  }
}
