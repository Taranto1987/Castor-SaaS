import { Router } from "express";
import { db, leadsTable, leadInteracoesTable, leadTarefasTable, customerProfilesTable, leadScoresTable, relationalCapsulesTable } from "@workspace/db";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /leads — lista com filtros opcionais
router.get("/leads", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { estagio, vendedor, origem, tag, search } = req.query;

    let rows = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.lojaId, lojaId))
      .orderBy(desc(leadsTable.atualizadoEm));

    if (estagio) rows = rows.filter((r) => r.estagio === estagio);
    if (vendedor) rows = rows.filter((r) => r.vendedorAtribuido === vendedor);
    if (origem) rows = rows.filter((r) => r.origem === origem);
    if (tag) rows = rows.filter((r) => (r.tags as string[]).includes(String(tag)));
    if (search) {
      const q = String(search).toLowerCase();
      rows = rows.filter(
        (r) =>
          r.nome.toLowerCase().includes(q) ||
          (r.whatsapp ?? "").includes(q)
      );
    }

    res.json({ leads: rows });
  } catch (err) {
    console.error("[Leads] GET /leads error:", err);
    res.status(500).json({ error: "Erro ao carregar leads" });
  }
});

// GET /leads/pipeline — contagem por estágio para Kanban
router.get("/leads/pipeline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;

    const rows = await db
      .select({
        estagio: leadsTable.estagio,
        count: sql<number>`count(*)::int`,
      })
      .from(leadsTable)
      .where(eq(leadsTable.lojaId, lojaId))
      .groupBy(leadsTable.estagio);

    const estagios = ["novo", "contato", "proposta", "negociacao", "ganho", "perdido"];
    const counts = Object.fromEntries(estagios.map((e) => [e, 0]));
    for (const r of rows) counts[r.estagio] = r.count;

    res.json({ pipeline: counts });
  } catch (err) {
    console.error("[Leads] pipeline error:", err);
    res.status(500).json({ error: "Erro ao carregar pipeline" });
  }
});

// GET /leads/:id — detalhe completo
router.get("/leads/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const id = parseInt(String(req.params.id), 10);

    const [lead] = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)));

    if (!lead) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    const [interacoes, tarefas] = await Promise.all([
      db
        .select()
        .from(leadInteracoesTable)
        .where(and(eq(leadInteracoesTable.leadId, id), eq(leadInteracoesTable.lojaId, lojaId)))
        .orderBy(desc(leadInteracoesTable.criadoEm)),
      db
        .select()
        .from(leadTarefasTable)
        .where(and(eq(leadTarefasTable.leadId, id), eq(leadTarefasTable.lojaId, lojaId)))
        .orderBy(leadTarefasTable.prazo),
    ]);

    let score = null;
    let capsule = null;

    if (lead.customerProfileId) {
      const [scoreRow] = await db
        .select()
        .from(leadScoresTable)
        .where(eq(leadScoresTable.customerId, lead.customerProfileId));
      score = scoreRow ?? null;

      const [capsuleRow] = await db
        .select()
        .from(relationalCapsulesTable)
        .where(eq(relationalCapsulesTable.customerId, lead.customerProfileId));
      capsule = capsuleRow ?? null;
    }

    res.json({ lead, interacoes, tarefas, score, capsule });
  } catch (err) {
    console.error("[Leads] GET /:id error:", err);
    res.status(500).json({ error: "Erro ao carregar lead" });
  }
});

// POST /leads — criar lead
router.post("/leads", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { nome, whatsapp, email, estagio, origem, tags, observacoes, vendedorAtribuido } = req.body;

    if (!nome?.trim()) {
      res.status(400).json({ error: "Nome é obrigatório" });
      return;
    }

    const [lead] = await db
      .insert(leadsTable)
      .values({
        lojaId,
        nome: nome.trim(),
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim() || null,
        estagio: estagio ?? "novo",
        origem: origem ?? "loja",
        tags: tags ?? [],
        observacoes: observacoes ?? null,
        vendedorAtribuido: vendedorAtribuido ?? req.session!.nome,
        ultimoContato: new Date(),
      })
      .returning();

    // Registrar interação inicial automática
    await db.insert(leadInteracoesTable).values({
      leadId: lead.id,
      lojaId,
      tipo: "nota",
      conteudo: `Lead criado por ${req.session!.nome}`,
      autorNome: req.session!.nome,
    });

    res.status(201).json({ lead });
  } catch (err) {
    console.error("[Leads] POST /leads error:", err);
    res.status(500).json({ error: "Erro ao criar lead" });
  }
});

// PATCH /leads/:id — atualizar lead
router.patch("/leads/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const id = parseInt(String(req.params.id), 10);

    const [existing] = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)));

    if (!existing) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    const allowed = [
      "nome", "whatsapp", "email", "estagio", "origem", "tags",
      "observacoes", "vendedorAtribuido", "perfilBiomecanico",
    ] as const;

    const updates: Record<string, unknown> = { atualizadoEm: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    // Registrar mudança de estágio como interação
    if ("estagio" in req.body && req.body.estagio !== existing.estagio) {
      await db.insert(leadInteracoesTable).values({
        leadId: id,
        lojaId,
        tipo: "nota",
        conteudo: `Estágio alterado: ${existing.estagio} → ${req.body.estagio}`,
        autorNome: req.session!.nome,
      });
      updates.ultimoContato = new Date();
    }

    const [lead] = await db
      .update(leadsTable)
      .set(updates)
      .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)))
      .returning();

    res.json({ lead });
  } catch (err) {
    console.error("[Leads] PATCH /:id error:", err);
    res.status(500).json({ error: "Erro ao atualizar lead" });
  }
});

// DELETE /leads/:id — arquivar (soft delete via estágio)
router.delete("/leads/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const id = parseInt(String(req.params.id), 10);

    await db
      .update(leadsTable)
      .set({ estagio: "perdido", atualizadoEm: new Date() })
      .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)));

    res.json({ ok: true });
  } catch (err) {
    console.error("[Leads] DELETE /:id error:", err);
    res.status(500).json({ error: "Erro ao arquivar lead" });
  }
});

// POST /leads/:id/interacoes — registrar interação
router.post("/leads/:id/interacoes", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const leadId = parseInt(String(req.params.id), 10);
    const { tipo, conteudo } = req.body;

    if (!conteudo?.trim()) {
      res.status(400).json({ error: "Conteúdo é obrigatório" });
      return;
    }

    const [interacao] = await db
      .insert(leadInteracoesTable)
      .values({
        leadId,
        lojaId,
        tipo: tipo ?? "nota",
        conteudo: conteudo.trim(),
        autorNome: req.session!.nome,
        autorId: String(req.session!.userId),
      })
      .returning();

    // Atualizar último contato do lead
    await db
      .update(leadsTable)
      .set({ ultimoContato: new Date(), atualizadoEm: new Date() })
      .where(and(eq(leadsTable.id, leadId), eq(leadsTable.lojaId, lojaId)));

    res.status(201).json({ interacao });
  } catch (err) {
    console.error("[Leads] POST interacoes error:", err);
    res.status(500).json({ error: "Erro ao registrar interação" });
  }
});

// GET /leads/:id/interacoes — timeline
router.get("/leads/:id/interacoes", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const leadId = parseInt(String(req.params.id), 10);

    const interacoes = await db
      .select()
      .from(leadInteracoesTable)
      .where(and(eq(leadInteracoesTable.leadId, leadId), eq(leadInteracoesTable.lojaId, lojaId)))
      .orderBy(desc(leadInteracoesTable.criadoEm));

    res.json({ interacoes });
  } catch (err) {
    console.error("[Leads] GET interacoes error:", err);
    res.status(500).json({ error: "Erro ao carregar interações" });
  }
});

// POST /leads/:id/tarefas — criar tarefa
router.post("/leads/:id/tarefas", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const leadId = parseInt(String(req.params.id), 10);
    const { descricao, tipo, prazo, responsavel } = req.body;

    if (!descricao?.trim()) {
      res.status(400).json({ error: "Descrição é obrigatória" });
      return;
    }

    const [tarefa] = await db
      .insert(leadTarefasTable)
      .values({
        leadId,
        lojaId,
        descricao: descricao.trim(),
        tipo: tipo ?? "follow_up",
        prazo: prazo ? new Date(prazo) : null,
        responsavel: responsavel ?? req.session!.nome,
      })
      .returning();

    res.status(201).json({ tarefa });
  } catch (err) {
    console.error("[Leads] POST tarefas error:", err);
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});

// PATCH /leads/:id/tarefas/:tid — concluir/editar tarefa
router.patch("/leads/:id/tarefas/:tid", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const tid = parseInt(String(req.params.tid), 10);
    const { concluso, descricao, prazo } = req.body;

    const [tarefa] = await db
      .update(leadTarefasTable)
      .set({
        ...(concluso !== undefined && { concluso }),
        ...(descricao && { descricao }),
        ...(prazo && { prazo: new Date(prazo) }),
      })
      .where(and(eq(leadTarefasTable.id, tid), eq(leadTarefasTable.lojaId, lojaId)))
      .returning();

    res.json({ tarefa });
  } catch (err) {
    console.error("[Leads] PATCH tarefa error:", err);
    res.status(500).json({ error: "Erro ao atualizar tarefa" });
  }
});

export default router;
