import { Router } from "express";
import { db, conversasWhatsappTable, mensagensWhatsappTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { logEvent } from "../lib/log-event";

const router = Router();

// SSE clients por lojaId para push de novas mensagens
const sseClients = new Map<number, Set<{ res: any }>>();

function broadcastToLoja(lojaId: number, data: unknown) {
  const clients = sseClients.get(lojaId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      (client.res as any).write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

// GET /inbox/stream — SSE para novos eventos em tempo real
router.get("/inbox/stream", requireAuth, (req: AuthRequest, res: any) => {
  const lojaId = req.session!.lojaId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const client = { res };
  if (!sseClients.has(lojaId)) sseClients.set(lojaId, new Set());
  sseClients.get(lojaId)!.add(client);

  // Heartbeat a cada 25s
  const hb = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(hb); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(hb);
    const set = sseClients.get(lojaId);
    if (set) {
      set.delete(client);
      if (set.size === 0) sseClients.delete(lojaId);
    }
  });
});

// GET /inbox/conversas — lista com status e contagem não lidas
router.get("/inbox/conversas", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;

    const conversas = await db
      .select()
      .from(conversasWhatsappTable)
      .where(eq(conversasWhatsappTable.lojaId, lojaId))
      .orderBy(desc(conversasWhatsappTable.ultimaMensagemEm));

    // Conta não lidas por conversa
    const naoLidas = await db
      .select({
        conversaId: mensagensWhatsappTable.conversaId,
        count: sql<number>`count(*)::int`,
      })
      .from(mensagensWhatsappTable)
      .where(
        and(
          eq(mensagensWhatsappTable.lojaId, lojaId),
          eq(mensagensWhatsappTable.lida, false),
          eq(mensagensWhatsappTable.direcao, "inbound")
        )
      )
      .groupBy(mensagensWhatsappTable.conversaId);

    const naoLidasMap = Object.fromEntries(naoLidas.map((r) => [r.conversaId, r.count]));

    // Última mensagem de cada conversa
    const ultimasMensagens = await db
      .select()
      .from(mensagensWhatsappTable)
      .where(eq(mensagensWhatsappTable.lojaId, lojaId))
      .orderBy(desc(mensagensWhatsappTable.criadoEm));

    const ultimaMap: Record<number, (typeof ultimasMensagens)[0]> = {};
    for (const m of ultimasMensagens) {
      if (!(m.conversaId in ultimaMap)) ultimaMap[m.conversaId] = m;
    }

    const result = conversas.map((c) => ({
      ...c,
      naoLidas: naoLidasMap[c.id] ?? 0,
      ultimaMensagem: ultimaMap[c.id] ?? null,
    }));

    res.json({ conversas: result });
  } catch (err) {
    console.error("[Inbox] GET conversas error:", err);
    res.status(500).json({ error: "Erro ao carregar conversas" });
  }
});

// GET /inbox/conversas/:phone — mensagens da conversa
router.get("/inbox/conversas/:phone", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const phone = String(req.params.phone);
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const [conversa] = await db
      .select()
      .from(conversasWhatsappTable)
      .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, phone)));

    if (!conversa) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }

    const mensagens = await db
      .select()
      .from(mensagensWhatsappTable)
      .where(and(eq(mensagensWhatsappTable.lojaId, lojaId), eq(mensagensWhatsappTable.conversaId, conversa.id)))
      .orderBy(desc(mensagensWhatsappTable.criadoEm))
      .limit(limit);

    // Marca como lidas
    await db
      .update(mensagensWhatsappTable)
      .set({ lida: true })
      .where(
        and(
          eq(mensagensWhatsappTable.conversaId, conversa.id),
          eq(mensagensWhatsappTable.lida, false),
          eq(mensagensWhatsappTable.direcao, "inbound")
        )
      );

    res.json({ conversa, mensagens: mensagens.reverse() });
  } catch (err) {
    console.error("[Inbox] GET mensagens error:", err);
    res.status(500).json({ error: "Erro ao carregar mensagens" });
  }
});

// POST /inbox/conversas/:phone/enviar — enviar mensagem como atendente
router.post("/inbox/conversas/:phone/enviar", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const phone = String(req.params.phone);
    const { texto } = req.body;

    if (!texto?.trim()) {
      res.status(400).json({ error: "Texto é obrigatório" });
      return;
    }

    // Garante que a conversa existe
    let [conversa] = await db
      .select()
      .from(conversasWhatsappTable)
      .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, phone)));

    if (!conversa) {
      [conversa] = await db
        .insert(conversasWhatsappTable)
        .values({ lojaId, phone, status: "humano", atendente: req.session!.nome })
        .returning();
    }

    // Envia via WAHA
    const wahaUrl = process.env.WAHA_URL;
    const wahaSession = process.env.WAHA_SESSION_NAME ?? "castor";

    if (wahaUrl) {
      await fetch(`${wahaUrl}/api/sendText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: wahaSession, chatId: phone, text: texto.trim() }),
      });
    }

    // Persiste mensagem
    const [mensagem] = await db
      .insert(mensagensWhatsappTable)
      .values({
        lojaId,
        conversaId: conversa.id,
        from: "loja",
        to: phone,
        body: texto.trim(),
        tipo: "text",
        direcao: "outbound",
        status: "enviado",
        atendente: req.session!.nome,
        lida: true,
      })
      .returning();

    // Atualiza timestamp da conversa
    await db
      .update(conversasWhatsappTable)
      .set({ ultimaMensagemEm: new Date() })
      .where(eq(conversasWhatsappTable.id, conversa.id));

    // Broadcast SSE
    broadcastToLoja(lojaId, { type: "nova_mensagem", phone, mensagem });

    res.status(201).json({ mensagem });
  } catch (err) {
    console.error("[Inbox] POST enviar error:", err);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

// PATCH /inbox/conversas/:phone/assumir — handoff IA → humano
router.patch("/inbox/conversas/:phone/assumir", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const phone = String(req.params.phone);

    const [conversa] = await db
      .update(conversasWhatsappTable)
      .set({
        status: "humano",
        atendente: req.session!.nome,
        ultimaMensagemEm: new Date(),
      })
      .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, phone)))
      .returning();

    if (!conversa) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }

    broadcastToLoja(lojaId, { type: "handoff", phone, atendente: req.session!.nome });
    logEvent({ lojaId, entidade: "conversa", entidadeId: phone,
               acao: "inbox.handoff_to_human", atorTipo: "usuario",
               payload: { atendente: req.session!.nome } });

    res.json({ conversa });
  } catch (err) {
    console.error("[Inbox] PATCH assumir error:", err);
    res.status(500).json({ error: "Erro ao assumir atendimento" });
  }
});

// PATCH /inbox/conversas/:phone/devolver — devolver para bot
router.patch("/inbox/conversas/:phone/devolver", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const phone = String(req.params.phone);

    const [conversa] = await db
      .update(conversasWhatsappTable)
      .set({ status: "bot", atendente: null, ultimaMensagemEm: new Date() })
      .where(and(eq(conversasWhatsappTable.lojaId, lojaId), eq(conversasWhatsappTable.phone, phone)))
      .returning();

    broadcastToLoja(lojaId, { type: "devolvido_bot", phone });
    logEvent({ lojaId, entidade: "conversa", entidadeId: phone,
               acao: "inbox.handoff_to_bot", atorTipo: "usuario", payload: {} });

    res.json({ conversa });
  } catch (err) {
    console.error("[Inbox] PATCH devolver error:", err);
    res.status(500).json({ error: "Erro ao devolver para bot" });
  }
});

// Exporta broadcast para uso no webhook do WAHA
export { broadcastToLoja };
export default router;
