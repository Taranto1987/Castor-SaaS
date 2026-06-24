import { db, leadsTable, leadInteracoesTable, leadTarefasTable, leadScoresTable, relationalCapsulesTable, diagnosticosTable, salesOpportunitiesTable, orcamentosTable } from "@workspace/db";
import { eq, and, desc, sql, ne, inArray, isNotNull, or } from "drizzle-orm";
import { logEvent } from "../../lib/log-event";
import { ALLOWED_PATCH_FIELDS, FIELD_LABELS, ESTAGIOS } from "./types";

// ── List / Pipeline ──────────────────────────────────────────────────────────────

export async function listLeads(
  lojaId: number,
  filters: { estagio?: string; vendedor?: string; origem?: string; tag?: string; search?: string },
) {
  let rows = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.lojaId, lojaId))
    .orderBy(desc(leadsTable.atualizadoEm));

  if (filters.estagio) rows = rows.filter((r) => r.estagio === filters.estagio);
  if (filters.vendedor) rows = rows.filter((r) => r.vendedorAtribuido === filters.vendedor);
  if (filters.origem) rows = rows.filter((r) => r.origem === filters.origem);
  if (filters.tag) rows = rows.filter((r) => (r.tags as string[]).includes(String(filters.tag)));
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    rows = rows.filter(
      (r) => r.nome.toLowerCase().includes(q) || (r.whatsapp ?? "").includes(q),
    );
  }

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

  return rows.map((r) => {
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
}

export async function getPipeline(lojaId: number) {
  const rows = await db
    .select({
      estagio: leadsTable.estagio,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .where(eq(leadsTable.lojaId, lojaId))
    .groupBy(leadsTable.estagio);

  const counts = Object.fromEntries(ESTAGIOS.map((e) => [e, 0]));
  for (const r of rows) counts[r.estagio] = r.count;
  return counts;
}

// ── Detail ───────────────────────────────────────────────────────────────────────

export async function getLeadDetail(id: number, lojaId: number) {
  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)));

  if (!lead) return null;

  const [interacoes, tarefas] = await Promise.all([
    db.select().from(leadInteracoesTable)
      .where(and(eq(leadInteracoesTable.leadId, id), eq(leadInteracoesTable.lojaId, lojaId)))
      .orderBy(desc(leadInteracoesTable.criadoEm)),
    db.select().from(leadTarefasTable)
      .where(and(eq(leadTarefasTable.leadId, id), eq(leadTarefasTable.lojaId, lojaId)))
      .orderBy(leadTarefasTable.prazo),
  ]);

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
    const [scoreRow] = await db.select().from(leadScoresTable)
      .where(and(eq(leadScoresTable.customerId, lead.customerProfileId), eq(leadScoresTable.lojaId, lojaId)));
    score = scoreRow ?? null;

    const [capsuleRow] = await db.select().from(relationalCapsulesTable)
      .where(and(eq(relationalCapsulesTable.customerId, lead.customerProfileId), eq(relationalCapsulesTable.lojaId, lojaId)));
    capsule = capsuleRow ?? null;

    const [diagRow] = await db.select().from(diagnosticosTable)
      .where(and(eq(diagnosticosTable.customerId, lead.customerProfileId), eq(diagnosticosTable.lojaId, lojaId)))
      .orderBy(desc(diagnosticosTable.criadoEm))
      .limit(1);
    diagnostico = diagRow ?? null;
  }

  return { lead, interacoes, tarefas, score, capsule, diagnostico, orcamentos };
}

// ── Create ───────────────────────────────────────────────────────────────────────

export async function createLead(
  lojaId: number,
  data: { nome: string; whatsapp?: string; email?: string; estagio?: string; origem?: string; tags?: string[]; observacoes?: string; vendedorAtribuido?: string },
  autorNome: string,
) {
  const [lead] = await db
    .insert(leadsTable)
    .values({
      lojaId,
      nome: data.nome.trim(),
      whatsapp: data.whatsapp?.trim() || null,
      email: data.email?.trim() || null,
      estagio: data.estagio ?? "novo",
      origem: data.origem ?? "loja",
      tags: data.tags ?? [],
      observacoes: data.observacoes ?? null,
      vendedorAtribuido: data.vendedorAtribuido ?? autorNome,
      ultimoContato: new Date(),
    })
    .returning();

  await db.insert(leadInteracoesTable).values({
    leadId: lead.id,
    lojaId,
    tipo: "nota",
    conteudo: `Lead criado por ${autorNome}`,
    autorNome,
  });

  logEvent({ lojaId, entidade: "lead", entidadeId: String(lead.id),
    acao: "lead.created", atorTipo: "usuario",
    payload: { nome: lead.nome, origem: lead.origem } });

  return lead;
}

// ── Reset (archive all) ──────────────────────────────────────────────────────────

export async function resetLeads(
  lojaId: number,
  tudo: boolean,
  autorNome: string,
  autorId: string,
) {
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
          ? `Lead arquivado na limpeza total do CRM por ${autorNome}`
          : `Lead arquivado no reset do CRM por ${autorNome}`,
        autorNome,
        autorId,
      })),
    );
  }

  logEvent({
    lojaId,
    entidade: "lead",
    acao: tudo ? "crm.limpeza_total" : "crm.reset",
    atorTipo: "usuario",
    payload: { arquivados: arquivados.length, por: autorNome, tudo },
  });

  return arquivados.length;
}

// ── Update (patch) ───────────────────────────────────────────────────────────────

export async function updateLead(
  id: number,
  lojaId: number,
  body: Record<string, unknown>,
  autorNome: string,
  autorId: string,
) {
  const [existing] = await db
    .select()
    .from(leadsTable)
    .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)));

  if (!existing) return { error: "Lead não encontrado", status: 404 };

  if ("estagio" in body && body.estagio === "cancelado" && existing.estagio !== "cancelado") {
    const motivo = String(body.motivo ?? "").trim();
    if (!motivo) return { error: "Motivo é obrigatório para cancelar um lead", status: 400 };
  }

  const updates: Record<string, unknown> = { atualizadoEm: new Date() };
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  const editedFields: string[] = [];
  for (const key of ALLOWED_PATCH_FIELDS) {
    if (key === "estagio") continue;
    if (key in body && JSON.stringify(body[key]) !== JSON.stringify(existing[key])) {
      editedFields.push(FIELD_LABELS[key] ?? key);
    }
  }
  if (editedFields.length > 0) {
    await db.insert(leadInteracoesTable).values({
      leadId: id,
      lojaId,
      tipo: "nota",
      conteudo: `Lead editado por ${autorNome}: ${editedFields.join(", ")} alterado${editedFields.length > 1 ? "s" : ""}`,
      autorNome,
      autorId,
    });
    logEvent({ lojaId, entidade: "lead", entidadeId: String(id),
      acao: "lead.edited", atorTipo: "usuario",
      payload: { campos: editedFields } });
  }

  if ("estagio" in body && body.estagio !== existing.estagio) {
    const novoEstagio = body.estagio as string;
    let conteudo = `Estágio alterado: ${existing.estagio} → ${novoEstagio}`;
    if (novoEstagio === "cancelado" && body.motivo) {
      conteudo += `. Motivo: ${String(body.motivo).trim()}`;
    }
    await db.insert(leadInteracoesTable).values({
      leadId: id,
      lojaId,
      tipo: "nota",
      conteudo,
      autorNome,
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

  if ("estagio" in body && body.estagio !== existing.estagio) {
    const novoEstagio = body.estagio as string;
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
            ),
          );
      } catch (syncErr) {
        console.error("[Leads] PATCH: falha ao sincronizar opportunity:", syncErr);
      }
    }
  }

  return { lead };
}

// ── Delete (soft) ────────────────────────────────────────────────────────────────

export async function archiveLead(id: number, lojaId: number) {
  await db
    .update(leadsTable)
    .set({ estagio: "perdido", atualizadoEm: new Date() })
    .where(and(eq(leadsTable.id, id), eq(leadsTable.lojaId, lojaId)));
}

// ── Interactions ─────────────────────────────────────────────────────────────────

export async function addInteracao(
  leadId: number,
  lojaId: number,
  data: { tipo?: string; conteudo: string },
  autorNome: string,
  autorId: string,
) {
  const [interacao] = await db
    .insert(leadInteracoesTable)
    .values({
      leadId,
      lojaId,
      tipo: data.tipo ?? "nota",
      conteudo: data.conteudo.trim(),
      autorNome,
      autorId,
    })
    .returning();

  await db
    .update(leadsTable)
    .set({ ultimoContato: new Date(), atualizadoEm: new Date() })
    .where(and(eq(leadsTable.id, leadId), eq(leadsTable.lojaId, lojaId)));

  return interacao;
}

export async function listInteracoes(leadId: number, lojaId: number) {
  return db
    .select()
    .from(leadInteracoesTable)
    .where(and(eq(leadInteracoesTable.leadId, leadId), eq(leadInteracoesTable.lojaId, lojaId)))
    .orderBy(desc(leadInteracoesTable.criadoEm));
}

// ── Tasks ────────────────────────────────────────────────────────────────────────

export async function createTarefa(
  leadId: number,
  lojaId: number,
  data: { descricao: string; tipo?: string; prazo?: string; responsavel?: string },
  defaultResponsavel: string,
) {
  const [tarefa] = await db
    .insert(leadTarefasTable)
    .values({
      leadId,
      lojaId,
      descricao: data.descricao.trim(),
      tipo: data.tipo ?? "follow_up",
      prazo: data.prazo ? new Date(data.prazo) : null,
      responsavel: data.responsavel ?? defaultResponsavel,
    })
    .returning();
  return tarefa;
}

export async function updateTarefa(
  tid: number,
  lojaId: number,
  data: { concluso?: boolean; descricao?: string; prazo?: string },
) {
  const [tarefa] = await db
    .update(leadTarefasTable)
    .set({
      ...(data.concluso !== undefined && { concluso: data.concluso }),
      ...(data.descricao && { descricao: data.descricao }),
      ...(data.prazo && { prazo: new Date(data.prazo) }),
    })
    .where(and(eq(leadTarefasTable.id, tid), eq(leadTarefasTable.lojaId, lojaId)))
    .returning();
  return tarefa;
}
