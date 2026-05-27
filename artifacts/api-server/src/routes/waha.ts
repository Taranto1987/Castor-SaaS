import { Router, type Request, type Response } from "express";
import { runCastorAgent, runOnExistingSession } from "../lib/castor-agent";

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

    // Reutiliza sessão existente do cliente ou cria nova.
    // Se a sessão armazenada estiver inválida/expirada, limpa e cria outra.
    const existingSession = sessionByPhone.get(numero);
    let result;

    if (existingSession) {
      try {
        result = await runOnExistingSession(existingSession, texto);
      } catch (sessionError) {
        console.warn(
          `[waha] sessão inválida para ${numero}; recriando sessão do agente`,
          sessionError,
        );
        sessionByPhone.delete(numero);

        try {
          result = await runCastorAgent(texto);
        } catch (newSessionError) {
          // Garante que nenhuma sessão inválida permaneça presa ao número.
          sessionByPhone.delete(numero);
          console.error(
            `[waha] falha ao recriar sessão do agente para ${numero}`,
            newSessionError,
          );
          return;
        }
      }
    } else {
      result = await runCastorAgent(texto);
    }

    sessionByPhone.set(numero, result.sessionId);

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
