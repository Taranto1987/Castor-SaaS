import { Router } from "express";
import type { Request, Response } from "express";
import {
  db,
  lojasTable,
  whatsappInstancesTable,
  conversasWhatsappTable,
  mensagensWhatsappTable,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { getSession, isDono } from "../lib/sessions";
import {
  createInstance,
  getQRCode,
  getConnectionState,
  logoutInstance,
  sendTextViaEvolution,
  setWebhookForInstance,
} from "../services/whatsapp/evolution-client";
import {
  getOrCreateInstance,
  updateStatus,
  getInstanceByLojaId,
} from "../services/whatsapp/instance-manager";
import { logger } from "../lib/logger";
import type { Session } from "../lib/sessions";
import { createCastorSession, sendCastorMessage, streamCastorEvents } from "../lib/castor-agent";
import { resolveOrCreateCustomerByPhone } from "../services/memory/identity";
import { logEvent } from "../lib/log-event";
import { broadcastToLoja } from "./inbox";
import { extractAndUpdateCapsule } from "../services/whatsapp/preference-extractor";

const router = Router();

// ── Dono-only session guard ────────────────────────────────────────────────

const pendingConnects = new Set<number>();

function requireDonoSession(req: Request, res: Response): Session | null {
  const token = (req.headers["x-session-token"] ?? "") as string;
  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão inválida" });
    return null;
  }
  if (!isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao dono" });
    return null;
  }
  return session;
}

async function getLojaSlug(lojaId: number): Promise<string | null> {
  const rows = await db
    .select({ slug: lojasTable.slug })
    .from(lojasTable)
    .where(eq(lojasTable.id, lojaId))
    .limit(1);
  return rows[0]?.slug ?? null;
}

// ── Evolution message processing ───────────────────────────────────────────

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const evolutionSessions = new Map<string, { id: string; lastSeen: number }>();

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [key, val] of evolutionSessions) {
    if (val.lastSeen < cutoff) evolutionSessions.delete(key);
  }
}, 60 * 60 * 1000);

// Fast-path dedup: in-memory cache of processed Evolution message IDs (FIFO, max 2000)
const processedEvolutionIds = new Set<string>();

function markProcessed(id: string) {
  if (processedEvolutionIds.size >= 2000) {
    const first = processedEvolutionIds.values().next().value;
    if (first) processedEvolutionIds.delete(first);
  }
  processedEvolutionIds.add(id);
}

async function resolveLojaByInstanceName(instanceName: string): Promise<number | null> {
  const rows = await db
    .select({ lojaId: whatsappInstancesTable.lojaId })
    .from(whatsappInstancesTable)
    .where(eq(whatsappInstancesTable.instanceId, instanceName))
    .limit(1);
  return rows[0]?.lojaId ?? null;
}

async function persistirMensagem(
  lojaId: number,
  phone: string,
  texto: string,
  direcao: "inbound" | "outbound",
  atendente?: string,
  messageId?: string,
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

  let mensagem = null;
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
        wahaMessageId: messageId ?? null,
      })
      .returning();
  } catch (err: unknown) {
    // Unique constraint = duplicate messageId — idempotent success
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

type EvolutionMessageData = {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
  };
  messageType?: string;
};

async function handleEvolutionMessage(
  instanceName: string,
  data: EvolutionMessageData,
): Promise<void> {
  const { key, message, messageType } = data;

  if (key?.fromMe) return;

  const remoteJid = key?.remoteJid ?? "";
  // Ignore group/broadcast messages
  if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) return;

  const phone = remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@.*$/, "");
  if (!phone) return;

  // Extract text — only process text messages
  const texto = (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    ""
  ).trim();

  if (!texto) return;

  const evolutionMsgId = key?.id;

  // Dedup: fast-path cache then DB
  if (evolutionMsgId) {
    if (processedEvolutionIds.has(evolutionMsgId)) return;
    const existing = await db
      .select({ id: mensagensWhatsappTable.id })
      .from(mensagensWhatsappTable)
      .where(eq(mensagensWhatsappTable.wahaMessageId, evolutionMsgId))
      .limit(1);
    if (existing.length > 0) return;
    markProcessed(evolutionMsgId);
  }

  const lojaId = await resolveLojaByInstanceName(instanceName);
  if (!lojaId) {
    logger.warn({ instanceName }, "evolution: loja not found for instance");
    return;
  }

  // Persist inbound message
  const { conversa: conversaInbound } = await persistirMensagem(
    lojaId, phone, texto, "inbound", undefined, evolutionMsgId,
  );

  // Identity resolution — link conversation to customer_profile
  let customerId: number | null = conversaInbound?.customerId ?? null;
  if (conversaInbound && !conversaInbound.customerId) {
    try {
      customerId = await resolveOrCreateCustomerByPhone(phone, null, lojaId);
      if (customerId) {
        await db
          .update(conversasWhatsappTable)
          .set({ customerId })
          .where(
            and(
              eq(conversasWhatsappTable.id, conversaInbound.id),
              isNull(conversasWhatsappTable.customerId),
            ),
          );
      }
    } catch (err) {
      logger.error({ err, phone }, "evolution: identity resolution failed");
    }
  }

  logEvent({
    lojaId,
    entidade: "whatsapp",
    entidadeId: evolutionMsgId,
    acao: "whatsapp.message_received",
    atorTipo: "sistema",
    payload: { phone, length: texto.length, provider: "evolution" },
  });

  // Check conversation mode — skip bot if human agent took over
  const [conversa] = await db
    .select()
    .from(conversasWhatsappTable)
    .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, phone)));

  if (conversa?.status === "humano") return;

  // Bot response via Castor Agent
  const sessionKey = `${lojaId}:${phone}`;
  const existingSession = evolutionSessions.get(sessionKey);
  const sessionId = existingSession?.id ?? (await createCastorSession(`evolution-${phone}`)).id;
  evolutionSessions.set(sessionKey, { id: sessionId, lastSeen: Date.now() });

  await sendCastorMessage(sessionId, texto);

  let responseText = "";
  const stream = await streamCastorEvents(sessionId);
  for await (const event of stream) {
    if (event?.type === "agent.message") {
      for (const block of (event.content ?? [])) {
        if (block?.type === "text") responseText += block.text;
      }
    }
    if (
      event?.type === "session.status_idle" ||
      event?.type === "session.status_terminated"
    ) break;
  }

  const resposta = responseText.trim() || "Recebi sua mensagem 👍";

  await sendTextViaEvolution(instanceName, phone, resposta);

  await persistirMensagem(lojaId, phone, resposta, "outbound", "ThallesZzz IA");

  // Async: extract customer preferences and update CRM capsule — never blocks response
  if (customerId) {
    extractAndUpdateCapsule(lojaId, customerId, texto, resposta).catch(
      (err) => logger.error({ err, customerId }, "preference extraction failed"),
    );
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

// POST /api/whatsapp/connect — start connection, return QR code
router.post("/connect", async (req: Request, res: Response) => {
  const session = requireDonoSession(req, res);
  if (!session) return;

  const { lojaId } = session;

  if (pendingConnects.has(lojaId)) {
    res.status(409).json({ error: "Conexão já em andamento" });
    return;
  }

  const slug = await getLojaSlug(lojaId);
  if (!slug) {
    res.status(404).json({ error: "Loja não encontrada" });
    return;
  }

  pendingConnects.add(lojaId);
  try {
    const instance = await getOrCreateInstance(lojaId, slug);
    const { instanceId } = instance;

    try {
      await createInstance(instanceId);
    } catch (err) {
      logger.warn({ err, instanceId }, "createInstance warning");
    }

    // Register webhook immediately after instance creation (don't block QR on failure)
    setWebhookForInstance(instanceId).catch((err) =>
      logger.warn({ err, instanceId }, "setWebhookForInstance warning"),
    );

    const qrcode = await getQRCode(instanceId);
    await updateStatus(instanceId, "awaiting_qr");
    res.json({ qrcode, instanceId, status: "awaiting_qr" });
  } catch (err) {
    logger.error({ err, lojaId }, "Failed to start WhatsApp connection");
    res.status(500).json({ error: "Falha ao gerar QR Code" });
  } finally {
    pendingConnects.delete(lojaId);
  }
});

// GET /api/whatsapp/status
router.get("/status", async (req: Request, res: Response) => {
  const session = requireDonoSession(req, res);
  if (!session) return;

  const { lojaId } = session;
  const slug = await getLojaSlug(lojaId);
  if (!slug) {
    res.status(404).json({ error: "Loja não encontrada" });
    return;
  }

  const instance = await getOrCreateInstance(lojaId, slug);

  if (instance.status !== "disconnected") {
    try {
      const state = await getConnectionState(instance.instanceId);
      if (state === "open" && instance.status !== "connected") {
        await updateStatus(instance.instanceId, "connected");
        res.json({ ...instance, status: "connected" });
        return;
      }
      if (state !== "open" && instance.status === "connected") {
        await updateStatus(instance.instanceId, "reconnect_required");
        res.json({ ...instance, status: "reconnect_required" });
        return;
      }
    } catch {
      // Evolution unreachable — return DB state as-is
    }
  }

  res.json(instance);
});

// DELETE /api/whatsapp/disconnect
router.delete("/disconnect", async (req: Request, res: Response) => {
  const session = requireDonoSession(req, res);
  if (!session) return;

  const { lojaId } = session;
  const instance = await getInstanceByLojaId(lojaId);
  if (!instance) {
    res.json({ ok: true });
    return;
  }

  try {
    await logoutInstance(instance.instanceId);
  } catch (err) {
    logger.warn({ err, instanceId: instance.instanceId }, "logoutInstance warning");
  }

  await updateStatus(instance.instanceId, "disconnected");
  res.json({ ok: true });
});

// POST /api/whatsapp/webhook — Evolution API events
// Auth: EVOLUTION_WEBHOOK_TOKEN obrigatório via header "apikey".
// Responde 200 imediatamente para evitar retries desnecessários da Evolution.
router.post("/webhook", async (req: Request, res: Response) => {
  const webhookToken =
    process.env.EVOLUTION_WEBHOOK_TOKEN ?? process.env.AUTHENTICATION_API_KEY ?? "";
  if (!webhookToken) {
    logger.warn("evolution webhook: token não configurado — rejeitando");
    res.status(503).json({ error: "Webhook não configurado" });
    return;
  }
  if (req.headers["apikey"] !== webhookToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = req.body as {
    event?: string;
    instance?: string;
    data?: Record<string, unknown>;
  };

  const { event, instance: instanceName, data } = payload;
  logger.info({ event, instanceName }, "evolution webhook");

  // Always ACK immediately so Evolution does not retry
  res.json({ ok: true });

  if (!instanceName) return;

  try {
    if (event === "connection.update") {
      const state = (data as { state?: string; number?: string })?.state;
      const number = (data as { state?: string; number?: string })?.number;
      if (state === "open") {
        await updateStatus(instanceName, "connected", number);
      } else if (state === "close" || state === "connecting") {
        await updateStatus(instanceName, "reconnect_required");
      }
    } else if (event === "messages.upsert") {
      await handleEvolutionMessage(instanceName, data as EvolutionMessageData);
    }
  } catch (err) {
    logger.error({ err, event, instanceName }, "evolution webhook processing error");
  }
});

export default router;
