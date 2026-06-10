import { Router, type Request, type Response } from "express";
import {
  createCastorSession,
  sendCastorMessage,
  streamCastorEvents,
} from "../lib/castor-agent";
import { db, conversasWhatsappTable, mensagensWhatsappTable, lojasTable } from "@workspace/db";
import { eq, and, sql, isNull } from "drizzle-orm";
import { broadcastToLoja } from "./inbox";
import { logEvent } from "../lib/log-event";
import { resolveOrCreateCustomerByPhone } from "../services/memory/identity";

const router = Router();

// Mantém sessão do agente por `${lojaId}:${phone}` — escopo por tenant, TTL 24h
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessionByPhone = new Map<string, { id: string; lastSeen: number }>();

let _sessionCleanupHandle: ReturnType<typeof setInterval> | null = setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [key, val] of sessionByPhone) {
    if (val.lastSeen < cutoff) sessionByPhone.delete(key);
  }
}, 60 * 60 * 1000); // cleanup a cada hora

export function stopWahaSessionCleanup() {
  if (_sessionCleanupHandle) { clearInterval(_sessionCleanupHandle); _sessionCleanupHandle = null; }
}

// Fast-path deduplication: IDs de mensagens já processadas (evita round-trip ao DB)
// Max 2000 entradas; entradas antigas são removidas por ordem de inserção (FIFO)
const processedMessageIds = new Set<string>();
const MAX_PROCESSED_CACHE = 2000;

function markProcessed(id: string) {
  if (processedMessageIds.size >= MAX_PROCESSED_CACHE) {
    const first = processedMessageIds.values().next().value;
    if (first) processedMessageIds.delete(first);
  }
  processedMessageIds.add(id);
}

// Resolve lojaId pelo número WAHA destino (multi-tenant) ou fallback = 1
async function resolveLojaByWahaPhone(toPhone?: string): Promise<number> {
  if (!toPhone) return 1;
  try {
    const rows = await db
      .select({ id: lojasTable.id })
      .from(lojasTable)
      .where(sql`${lojasTable.configJson}->>'wahaPhone' = ${toPhone}`)
      .limit(1);
    return rows[0]?.id ?? 1;
  } catch {
    return 1;
  }
}

async function persistirMensagem(
  lojaId: number,
  phone: string,
  texto: string,
  direcao: "inbound" | "outbound",
  atendente?: string,
  wahaMessageId?: string,
) {
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

  let mensagem;
  try {
    [mensagem] = await db
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
        wahaMessageId: wahaMessageId ?? null,
      })
      .returning();
  } catch (err: unknown) {
    // Unique constraint violation = duplicate wahaMessageId — idempotent success
    if ((err as { code?: string }).code === "23505") return { conversa, mensagem: null };
    throw err;
  }

  await db
    .update(conversasWhatsappTable)
    .set({ ultimaMensagemEm: new Date() })
    .where(eq(conversasWhatsappTable.id, conversa.id));

  broadcastToLoja(lojaId, { type: "nova_mensagem", phone, mensagem, conversa });

  return { conversa, mensagem };
}

router.post("/webhook/waha", async (req: Request, res: Response) => {
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
    const wahaMessageId: string | undefined = payload.id ?? undefined;

    if (!texto.trim() || !numero) return;

    // ── Deduplicação (Prioridade 1) ──────────────────────────────────────────
    if (wahaMessageId) {
      // Fast-path: cache em memória
      if (processedMessageIds.has(wahaMessageId)) {
        return; // duplicata já processada neste processo
      }

      // Slow-path: checar DB (cobre restart do processo)
      const existing = await db
        .select({ id: mensagensWhatsappTable.id })
        .from(mensagensWhatsappTable)
        .where(eq(mensagensWhatsappTable.wahaMessageId, wahaMessageId))
        .limit(1);

      if (existing.length > 0) {
        return; // duplicata já no banco
      }

      markProcessed(wahaMessageId);
    }

    // ── Resolve loja (multi-tenant) ──────────────────────────────────────────
    const lojaId = await resolveLojaByWahaPhone(payload.to as string | undefined);

    // ── Persiste mensagem inbound ────────────────────────────────────────────
    const { conversa: conversaInbound } = await persistirMensagem(lojaId, numero, texto.trim(), "inbound", undefined, wahaMessageId);

    // ── Resolução de identidade — liga conversa ao customer_profile ──────────
    if (conversaInbound && !conversaInbound.customerId) {
      try {
        const customerId = await resolveOrCreateCustomerByPhone(numero, null, lojaId);
        if (customerId) {
          await db.update(conversasWhatsappTable)
            .set({ customerId })
            .where(and(
              eq(conversasWhatsappTable.id, conversaInbound.id),
              isNull(conversasWhatsappTable.customerId),
            ));
        }
      } catch (idErr) {
        console.error("[waha] identity resolution failed:", idErr);
      }
    }

    logEvent({
      lojaId,
      entidade: "whatsapp",
      entidadeId: wahaMessageId,
      acao: "whatsapp.message_received",
      atorTipo: "sistema",
      payload: { phone: numero, length: texto.length },
    });

    // Verifica se conversa está em modo humano — não processa com bot
    const [conversa] = await db
      .select()
      .from(conversasWhatsappTable)
      .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, numero)));

    if (conversa?.status === "humano") return;

    // ── Processa com bot — sessionKey com escopo por tenant ──────────────────
    const sessionKey = `${lojaId}:${numero}`;
    const existingSession = sessionByPhone.get(sessionKey);
    const sessionId = existingSession?.id ?? (await createCastorSession(`waha-${numero}`)).id;
    sessionByPhone.set(sessionKey, { id: sessionId, lastSeen: Date.now() });

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

    const wahaUrl = process.env.WAHA_URL;
    const wahaSession = process.env.WAHA_SESSION_NAME ?? "castor";

    if (!wahaUrl) {
      console.error("[waha] WAHA_URL não configurada");
      return;
    }

    const respostaTexto = text.trim() || "Recebi sua mensagem 👍";
    const wahaRes = await fetch(`${wahaUrl}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: wahaSession, chatId: numero, text: respostaTexto }),
    });
    if (!wahaRes.ok) {
      console.error(`[waha] API error: status=${wahaRes.status} lojaId=${lojaId} phone=${numero}`);
    }

    // Persiste resposta do bot
    await persistirMensagem(lojaId, numero, respostaTexto, "outbound", "ThallesZzz IA");
  } catch (e) {
    console.error("[waha] erro ao processar mensagem:", e);
  }
});

export default router;
