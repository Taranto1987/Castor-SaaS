import { Router, type Request, type Response } from "express";
import {
  createCastorSession,
  sendCastorMessage,
  streamCastorEvents,
} from "../lib/castor-agent";

const router = Router();

// Mantém sessão do agente por número de telefone (em memória)
const sessionByPhone = new Map<string, string>();

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
    const sessionId = existingSession ?? (await createCastorSession(`waha-${numero}`)).id;
    sessionByPhone.set(numero, sessionId);

    await sendCastorMessage(sessionId, texto);

    let text = "";
    const stream = await streamCastorEvents(sessionId);
    for await (const event of stream) {
      if (event?.type === "agent.message") {
        for (const block of (event.content ?? [])) {
          if (block?.type === "text") text += block.text;
        }
      }
      if (event?.type === "session.status_idle" || event?.type === "session.status_terminated") break;
    }

    const result = { text: text.trim() };

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
