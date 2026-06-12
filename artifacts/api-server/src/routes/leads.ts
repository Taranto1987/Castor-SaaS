import { Router } from "express";
import { db, leadsTable, leadInteracoesTable, leadTarefasTable, leadScoresTable, relationalCapsulesTable, diagnosticosTable, salesOpportunitiesTable, orcamentosTable } from "@workspace/db";
import { eq, and, desc, sql, ne, inArray, isNotNull, or } from "drizzle-orm";
import { requireAuth, parseLojaIdPayload, type AuthRequest } from "../middlewares/auth";
import { logEvent } from "../lib/log-event";
import { isDono } from "../lib/sessions";
import { resolveOrCreateCustomerByPhone } from "../services/memory/identity";
import { ensureLeadForCustomer } from "../services/operacoes/repository";

const router = Router();

const TAMANHOS_VALIDOS = ["solteiro", "casal", "queen", "king"] as const;
const CONJUNTOS_VALIDOS = ["colchao", "box_colchao", "box_bau_colchao"] as const;

// Telefone BR: DDD válido + 8/9 dígitos, com 55 opcional
function whatsappBRValido(digits: string): boolean {
  return /^(55)?[1-9][0-9]9?[0-9]{8}$/.test(digits);
}

// POST /leads/mapa-sono — PÚBLICO: lead do funil Mapa do Sono 2.0.
// Contrato { success, data, error? }. lojaId obrigatório — sem default silencioso.
// Não substitui o POST /leads autenticado do CRM interno.
router.post("/leads/mapa-sono", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const lojaId = parseLojaIdPayload(body.lojaId);
    if (lojaId === null) {
      res.status(400).json({ success: false, error: "lojaId é obrigatório" });
      return;
    }

    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    if (!nome) {
      res.status(400).json({ success: false, error: "Nome é obrigatório" });
      return;
    }

    const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.replace(/\D/g, "") : "";
    if (!whatsappBRValido(whatsapp)) {
      res.status(400).json({ success: false, error: "WhatsApp inválido (formato BR com DDD)" });
      return;
    }

    // "mapa_sono" é o valor canônico já usado pelo CRM (Clientes.tsx) e pelo
    // fluxo legado (/api/diagnostico); aceita o alias do blueprint por compat.
    if (body.origem !== "mapa_sono" && body.origem !== "mapa_do_sono") {
      res.status(400).json({ success: false, error: "origem inválida" });
      return;
    }

    const tamanho = typeof body.tamanho === "string" && (TAMANHOS_VALIDOS as readonly string[]).includes(body.tamanho)
      ? body.tamanho : null;
    const conjunto = typeof body.conjunto === "string" && (CONJUNTOS_VALIDOS as readonly string[]).includes(body.conjunto)
      ? body.conjunto : null;
    if (!tamanho || !conjunto) {
      res.status(400).json({ success: false, error: "tamanho e conjunto são obrigatórios" });
      return;
    }

    const resultado = (typeof body.resultado === "object" && body.resultado !== null)
      ? body.resultado as Record<string, unknown>
      : { ranking: [] };
    const ranking = Array.isArray(resultado.ranking) ? resultado.ranking : [];
    const top = (typeof ranking[0] === "object" && ranking[0] !== null)
      ? ranking[0] as Record<string, unknown>
      : null;

    const perfil = (typeof body.perfil === "object" && body.perfil !== null)
      ? body.perfil as Record<string, unknown>
      : {};

    // Identidade (Digital Twin) + lead CRM — mesmo caminho do /api/diagnostico
    const customerId = await resolveOrCreateCustomerByPhone(whatsapp, nome, lojaId);
    const leadId = await ensureLeadForCustomer({
      lojaId,
      customerId,
      nome,
      whatsapp,
      origem: "mapa_sono",
      estagioMinimo: "novo",
    });

    const [diag] = await db.insert(diagnosticosTable).values({
      lojaId,
      customerId: customerId ?? undefined,
      leadId: leadId ?? undefined,
      nome,
      whatsapp,
      produto_recomendado: typeof top?.nome === "string" ? top.nome : null,
      confianca: typeof top?.score === "number" ? String(top.score / 100) : null,
      respostas: { ...perfil, tamanho, conjunto, origem: "mapa_sono" },
      resultado,
      perfil_comportamental: (typeof body.telemetria === "object" && body.telemetria !== null)
        ? body.telemetria as Record<string, unknown>
        : {},
    }).returning({ id: diagnosticosTable.id });

    logEvent({
      lojaId,
      entidade: "lead",
      entidadeId: leadId !== null ? String(leadId) : undefined,
      acao: "lead.mapa_sono_criado",
      atorTipo: "sistema",
      payload: { diagnosticoId: diag?.id ?? null, top: top?.nome ?? null, tamanho, conjunto },
    });

    res.status(201).json({ success: true, data: { leadId, diagnosticoId: diag?.id ?? null } });
  } catch (err) {
    console.error("[Leads] POST /leads/mapa-sono error:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar lead" });
  }
});

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

    // Enrich with opportunity data (latest opp per lead)
    const opps = await db
      .select({
        leadId: salesOpportunitiesTable.leadId,
        valorNumerico: salesOpportunitiesTable.valorNumerico,
        valorBrl: salesOpportunitiesTable.valorBrl,
        closingProbability: salesOpportunitiesTable.closingProbability,
        proximaAcao: salesOpportunitiesTable.proximaAcao,
        diasSemResposta: salesOpportunitiesTable.diasSemResposta,
      })
      .from(salesOpportunitiesTable)
      .where(and(
        eq(salesOpportunitiesTable.lojaId, lojaId),
        isNotNull(salesOpportunitiesTable.leadId),
      ))
      .orderBy(desc(salesOpportunitiesTable.criadoEm));

    const oppMap = new Map<number, typeof opps[0]>();
    for (const opp of opps) {
      if (opp.leadId !== null && !oppMap.has(opp.leadId)) {
        oppMap.set(opp.leadId, opp);
      }
    }

    const enriched = rows.map((r) => {
      const opp = oppMap.get(r.id);
      return {
        ...r,
        valorNumerico: opp?.valorNumerico ?? 0,
        valorBrl: opp?.valorBrl ?? null,
        closingProbability: opp?.closingProbability ?? 0,
        proximaAcao: opp?.proximaAcao ?? null,
        oppDiasSemResposta: opp?.diasSemResposta ?? null,
      };
    });

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ leads: enriched });
  } catch (err) {
    console.error("[Leads] GET /leads error:", err);
    res.status(500).set("Cache-Control", "no-store").json({ error: "Erro ao carregar leads" });
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

    // Orçamentos linked to this lead (by leadId or customerProfileId)
    const orcConds = lead.customerProfileId
      ? or(eq(orcamentosTable.leadId, id), eq(orcamentosTable.customerId, lead.customerProfileId))
      : eq(orcamentosTable.leadId, id);
    const orcamentos = await db
      .select({
        id: orcamentosTable.id,
        cliente: orcamentosTable.cliente,
        status: orcamentosTable.status,
        totalPix: orcamentosTable.totalPix,
        totalPrazo: orcamentosTable.totalPrazo,
        vendedor: orcamentosTable.vendedor,
        criadoEm: orcamentosTable.criadoEm,
        vendidoEm: orcamentosTable.vendidoEm,
      })
      .from(orcamentosTable)
      .where(and(eq(orcamentosTable.lojaId, lojaId), orcConds))
      .orderBy(desc(orcamentosTable.criadoEm))
      .limit(20);

    let score = null;
    let capsule = null;
    let diagnostico = null;

    if (lead.customerProfileId) {
      const [scoreRow] = await db
        .select()
        .from(leadScoresTable)
        .where(and(eq(leadScoresTable.customerId, lead.customerProfileId), eq(leadScoresTable.lojaId, lojaId)));
      score = scoreRow ?? null;

      const [capsuleRow] = await db
        .select()
        .from(relationalCapsulesTable)
        .where(and(eq(relationalCapsulesTable.customerId, lead.customerProfileId), eq(relationalCapsulesTable.lojaId, lojaId)));
      capsule = capsuleRow ?? null;

      // SleepMap: latest Mapa do Sono diagnosis for this customer (powers the CRM sleep panel)
      const [diagRow] = await db
        .select()
        .from(diagnosticosTable)
        .where(and(eq(diagnosticosTable.customerId, lead.customerProfileId), eq(diagnosticosTable.lojaId, lojaId)))
        .orderBy(desc(diagnosticosTable.criadoEm))
        .limit(1);
      diagnostico = diagRow ?? null;
    }

    res.json({ lead, interacoes, tarefas, score, capsule, diagnostico, orcamentos });
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

    logEvent({ lojaId, entidade: "lead", entidadeId: String(lead.id),
               acao: "lead.created", atorTipo: "usuario",
               payload: { nome: lead.nome, origem: lead.origem } });

    res.status(201).json({ lead });
  } catch (err) {
    console.error("[Leads] POST /leads error:", err);
    res.status(500).json({ error: "Erro ao criar lead" });
  }
});

// POST /leads/reset — arquivar todos os leads ativos (dono/admin only, soft delete)
router.post("/leads/reset", requireAuth, async (req: AuthRequest, res) => {
  try {
    const session = req.session!;
    if (!isDono(session)) {
      res.status(403).json({ error: "Apenas dono/admin pode resetar o CRM" });
      return;
    }
    const lojaId = session.lojaId;
    // tudo=true: inclui ganho e perdido (limpeza de dados de teste)
    const tudo = req.body?.tudo === true;
    const ESTAGIOS_ATIVOS = tudo
      ? ["novo", "contato", "proposta", "negociacao", "ganho", "perdido"]
      : ["novo", "contato", "proposta", "negociacao"];

    const arquivados = await db
      .update(leadsTable)
      .set({ estagio: "arquivado", atualizadoEm: new Date() })
      .where(and(
        eq(leadsTable.lojaId, lojaId),
        inArray(leadsTable.estagio, ESTAGIOS_ATIVOS),
      ))
      .returning({ id: leadsTable.id });

    if (arquivados.length > 0) {
      await db.insert(leadInteracoesTable).values(
        arquivados.map(({ id }) => ({
          leadId: id,
          lojaId,
          tipo: "nota" as const,
          conteudo: tudo
            ? `Lead arquivado na limpeza total do CRM por ${session.nome}`
            : `Lead arquivado no reset do CRM por ${session.nome}`,
          autorNome: session.nome,
          autorId: String(session.userId),
        }))
      );
    }

    logEvent({
      lojaId,
      entidade: "lead",
      acao: tudo ? "crm.limpeza_total" : "crm.reset",
      atorTipo: "usuario",
      payload: { arquivados: arquivados.length, por: session.nome, tudo },
    });

    res.json({ arquivados: arquivados.length });
  } catch (err) {
    console.error("[Leads] POST /leads/reset error:", err);
    res.status(500).json({ error: "Erro ao resetar CRM" });
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

    // Cancelamento requer motivo obrigatório
    if ("estagio" in req.body && req.body.estagio === "cancelado" && existing.estagio !== "cancelado") {
      const motivo = String(req.body.motivo ?? "").trim();
      if (!motivo) {
        res.status(400).json({ error: "Motivo é obrigatório para cancelar um lead" });
        return;
      }
    }

    const allowed = [
      "nome", "whatsapp", "email", "estagio", "origem", "tags",
      "observacoes", "vendedorAtribuido", "perfilBiomecanico",
      "motivoPerda", "motivoGanho",
    ] as const;

    const updates: Record<string, unknown> = { atualizadoEm: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    // Registrar campos editados como interação de auditoria
    const FIELD_LABELS: Partial<Record<typeof allowed[number], string>> = {
      nome: "Nome", whatsapp: "WhatsApp", email: "E-mail",
      origem: "Origem", tags: "Tags", observacoes: "Observações",
      vendedorAtribuido: "Vendedor", perfilBiomecanico: "Perfil biomecanico",
      motivoPerda: "Motivo perda", motivoGanho: "Motivo ganho",
    };
    const editedFields: string[] = [];
    for (const key of allowed) {
      if (key === "estagio") continue;
      if (key in req.body && JSON.stringify(req.body[key]) !== JSON.stringify(existing[key])) {
        editedFields.push(FIELD_LABELS[key] ?? key);
      }
    }
    if (editedFields.length > 0) {
      await db.insert(leadInteracoesTable).values({
        leadId: id,
        lojaId,
        tipo: "nota",
        conteudo: `Lead editado por ${req.session!.nome}: ${editedFields.join(", ")} alterado${editedFields.length > 1 ? "s" : ""}`,
        autorNome: req.session!.nome,
        autorId: String(req.session!.userId),
      });
      logEvent({ lojaId, entidade: "lead", entidadeId: String(id),
                 acao: "lead.edited", atorTipo: "usuario",
                 payload: { campos: editedFields } });
    }

    // Registrar mudança de estágio como interação
    if ("estagio" in req.body && req.body.estagio !== existing.estagio) {
      const novoEstagio = req.body.estagio as string;
      let conteudo = `Estágio alterado: ${existing.estagio} → ${novoEstagio}`;
      if (novoEstagio === "cancelado" && req.body.motivo) {
        conteudo += `. Motivo: ${String(req.body.motivo).trim()}`;
      }
      await db.insert(leadInteracoesTable).values({
        leadId: id,
        lojaId,
        tipo: "nota",
        conteudo,
        autorNome: req.session!.nome,
      });
      updates.ultimoContato = new Date();
      logEvent({ lojaId, entidade: "lead", entidadeId: String(id),
                 acao: "lead.stage_changed", atorTipo: "usuario",
                 payload: { de: existing.estagio, para: novoEstagio } });
    }

    const [lead] = await db
      .update(leadsTable)
      .set(updates)
      .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)))
      .returning();

    // Sync salesOpportunity status when lead reaches terminal stage
    if ("estagio" in req.body && req.body.estagio !== existing.estagio) {
      const novoEstagio = req.body.estagio as string;
      if (novoEstagio === "ganho" || novoEstagio === "perdido") {
        const oppStatus = novoEstagio === "ganho" ? "GANHO" : "PERDIDO";
        try {
          await db
            .update(salesOpportunitiesTable)
            .set({ status: oppStatus, proximaAcao: "Concluído", atualizadoEm: new Date() })
            .where(
              and(
                eq(salesOpportunitiesTable.leadId, id),
                eq(salesOpportunitiesTable.lojaId, lojaId),
                ne(salesOpportunitiesTable.status, "GANHO"),
                ne(salesOpportunitiesTable.status, "PERDIDO"),
              )
            );
        } catch (syncErr) {
          console.error("[Leads] PATCH: falha ao sincronizar opportunity:", syncErr);
        }
      }
    }

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
