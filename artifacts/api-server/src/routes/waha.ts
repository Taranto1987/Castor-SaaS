import { Router, type Request, type Response } from "express";
import {
  createCastorSession,
  sendCastorMessage,
  streamCastorEvents,
} from "../lib/castor-agent";
import { db, conversasWhatsappTable, mensagensWhatsappTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { broadcastToLoja } from "./inbox";

const router = Router();

// Mantém sessão do agente por número de telefone (em memória)
const sessionByPhone = new Map<string, string>();

const DEFAULT_LOJA_ID = 1;

async function persistirMensagem(lojaId: number, phone: string, texto: string, direcao: "inbound" | "outbound", atendente?: string) {
  let [conversa] = await db
    .select()
    .from(conversasWhatsappTable)
    .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, phone)));

  if (!conversa) {
    [conversa] = await db
      .insert(conversasWhatsappTable)
      .values({ lojaId, phone, status: "bot" })
      .returning();
  }

  const [mensagem] = await db
    .insert(mensagensWhatsappTable)
    .values({
      lojaId,
      conversaId: conversa.id,
      from: direcao === "inbound" ? phone : "loja",
      to: direcao === "inbound" ? "loja" : phone,
      body: texto,
      tipo: "text",
      direcao,
      status: "enviado",
      atendente: atendente ?? null,
      lida: direcao === "outbound",
    })
    .returning();

  await db
    .update(conversasWhatsappTable)
    .set({ ultimaMensagemEm: new Date() })
    .where(eq(conversasWhatsappTable.id, conversa.id));

  broadcastToLoja(lojaId, { type: "nova_mensagem", phone, mensagem, conversa });

  return { conversa, mensagem };
}

router.post("/webhook/waha", async (req: Request, res: Response) => {
  // Optional pre-shared secret: configure WAHA_WEBHOOK_SECRET and set the same
  // value in WAHA's webhook settings → Custom Headers → X-Waha-Token.
  const secret = process.env.WAHA_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers["x-waha-token"] ?? req.headers["x-webhook-secret"];
    if (provided !== secret) {
      res.sendStatus(401);
      return;
    }
  }

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

    // Persiste mensagem inbound no banco
    const lojaId = DEFAULT_LOJA_ID;
    await persistirMensagem(lojaId, numero, texto.trim(), "inbound");

    // Verifica se conversa está em modo humano — não processa com bot
    const [conversa] = await db
      .select()
      .from(conversasWhatsappTable)
      .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, numero)));

    if (conversa?.status === "humano") return;

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

    const respostaTexto = result.text || "Recebi sua mensagem 👍";
    await fetch(`${wahaUrl}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: wahaSession,
        chatId: numero,
        text: respostaTexto,
      }),
    });

    // Persiste resposta do bot no banco
    await persistirMensagem(lojaId, numero, respostaTexto, "outbound", "ThallesZzz IA");
  } catch (e) {
    console.error("[waha] erro ao processar mensagem:", e);
  }
});

export default router;
