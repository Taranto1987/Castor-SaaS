import { Router, type Request, type Response } from "express";
import { runCastorAgent, runOnExistingSession } from "../lib/castor-agent";
import { sendLeadEvent } from "../lib/meta-capi-client";

const router = Router();

// Mantém sessão do agente por número de telefone (em memória)
const sessionByPhone = new Map<string, string>();

// Números que já receberam evento CAPI de Lead nesta sessão do servidor
const capiLeadFired = new Set<string>();

router.post("/webhook/waha", async (req: Request, res: Response) => {
  // Responde 200 imediatamente para o WAHA não retentar
  res.sendStatus(200);

  try {
    const payload = req.body?.payload;
    if (!payload) return;

    // Ignora mensagens enviadas pelo próprio bot
    if (payload.fromMe) return;

    const texto: string = payload.body ?? "";
    const numero: string = payload.from ?? "";

    if (!texto.trim() || !numero) return;

    // Reutiliza sessão existente do cliente ou cria nova
    const existingSession = sessionByPhone.get(numero);
    const isNewLead = !existingSession;

    const result = existingSession
      ? await runOnExistingSession(existingSession, texto)
      : await runCastorAgent(texto);

    sessionByPhone.set(numero, result.sessionId);

    // Dispara evento CAPI de Lead no primeiro contato via WhatsApp
    if (isNewLead && !capiLeadFired.has(numero)) {
      capiLeadFired.add(numero);
      setImmediate(() => {
        sendLeadEvent({ phone: numero, leadScore: 60 }).catch((e) =>
          console.error("[waha] CAPI Lead erro:", e),
        );
      });
    }

    const wahaUrl = process.env.WAHA_URL;
    const wahaSession = process.env.WAHA_SESSION_NAME ?? "castor";

    if (!wahaUrl) {
      console.error("[waha] WAHA_URL não configurada");
      return;
    }

    await fetch(`${wahaUrl}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: wahaSession,
        chatId: numero,
        text: result.text || "Recebi sua mensagem 👍",
      }),
    });
  } catch (e) {
    console.error("[waha] erro ao processar mensagem:", e);
  }
});

export default router;
