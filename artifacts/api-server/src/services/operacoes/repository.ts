import { db } from "@workspace/db";
import {
  salesOpportunitiesTable,
  leadScoresTable,
  leadsTable,
  entregasTable,
  produtosTable,
  followUpsTable,
} from "@workspace/db/schema";
import { and, eq, desc, ne, sql, lte } from "drizzle-orm";
import { resolveOrCreateCustomerByPhone } from "../memory/identity";
import { logEvent } from "../../lib/log-event";

/** Parse a pt-BR formatted currency string ("R$ 4.699,00") into a number. */
export function parseBRL(v?: string | null): number {
  if (!v) return 0;
  const cleaned = v
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3})/g, "") // drop thousands separators
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function deriveProximaAcao(score: number, status: string): string {
  if (status === "GANHO" || status === "PERDIDO") return "Concluído";
  if (score >= 90) return "Intervenção Humana";
  if (score >= 70) return "Ligar";
  return "WhatsApp Automático";
}

const TERMINAL = ["GANHO", "PERDIDO"];

/**
 * Ingestão comercial unificada — garante 1 lead (CRM) por cliente (customer_profile),
 * sem duplicar. É o que mantém COCA e CRM com a MESMA fonte de verdade: qualquer ponto
 * de entrada (orçamento, diagnóstico, chat) deve resolver o customer_profile e chamar isto.
 * Best-effort: nunca lança. Retorna o leadId quando possível.
 */
export async function ensureLeadForCustomer(params: {
  lojaId: number;
  customerId: number;
  nome: string;
  whatsapp?: string | null;
  vendedor?: string | null;
  origem?: string;
  estagioMinimo?: string;
}): Promise<number | null> {
  const { lojaId, customerId, nome, whatsapp, vendedor, origem = "orcamento", estagioMinimo } = params;
  try {
    const now = new Date();
    const [existing] = await db
      .select({ id: leadsTable.id, estagio: leadsTable.estagio })
      .from(leadsTable)
      .where(and(eq(leadsTable.lojaId, lojaId), eq(leadsTable.customerProfileId, customerId)))
      .limit(1);

    if (existing) {
      // Avança o estágio só pra frente (nunca regride um lead já em negociação/ganho)
      const ordem = ["novo", "contato", "proposta", "negociacao", "ganho", "perdido"];
      const atual = ordem.indexOf(existing.estagio);
      const alvo = estagioMinimo ? ordem.indexOf(estagioMinimo) : -1;
      const estagio = alvo > atual ? estagioMinimo! : existing.estagio;
      await db
        .update(leadsTable)
        .set({ nome, whatsapp: whatsapp ?? null, estagio, ultimoContato: now, atualizadoEm: now })
        .where(eq(leadsTable.id, existing.id));
      return existing.id;
    }

    const [created] = await db
      .insert(leadsTable)
      .values({
        lojaId,
        customerProfileId: customerId,
        nome,
        whatsapp: whatsapp ?? null,
        origem,
        estagio: estagioMinimo ?? "novo",
        vendedorAtribuido: vendedor ?? null,
        ultimoContato: now,
      })
      .returning({ id: leadsTable.id });
    return created?.id ?? null;
  } catch (err) {
    console.error("[operacoes] ensureLeadForCustomer failed:", err);
    return null;
  }
}

export interface OrcamentoForOpportunity {
  id: number;
  lojaId?: number | null;
  cliente: string;
  whatsapp?: string | null;
  vendedor?: string | null;
  totalPix?: string | null;
  totalPrazo?: string | null;
}

/**
 * Idempotently create (or refresh) the sales opportunity for a saved orçamento.
 * Best-effort: never throws — a failure here must not break the quote flow.
 * Resolves the customer by phone to inherit the existing lead_score.
 */
export async function ensureOpportunityForOrcamento(orc: OrcamentoForOpportunity): Promise<void> {
  try {
    const lojaId = orc.lojaId ?? 1;

    // Resolve identity → lets us reuse the existing lead score (keyed by customerId)
    let customerId: number | null = null;
    if (orc.whatsapp) {
      try {
        customerId = await resolveOrCreateCustomerByPhone(orc.whatsapp, orc.cliente ?? null, lojaId);
      } catch {
        customerId = null;
      }
    }

    let score = 0;
    let closingProbability = 0;
    if (customerId) {
      const [ls] = await db
        .select({ score: leadScoresTable.score, cp: leadScoresTable.closingProbability })
        .from(leadScoresTable)
        .where(and(eq(leadScoresTable.customerId, customerId), eq(leadScoresTable.lojaId, lojaId)))
        .limit(1);
      if (ls) {
        score = ls.score ?? 0;
        closingProbability = ls.cp ?? 0;
      }
    }

    // Ingestão unificada: garante o lead (CRM) ligado ao mesmo cliente → COCA e CRM em sincronia
    let leadId: number | null = null;
    if (customerId) {
      leadId = await ensureLeadForCustomer({
        lojaId,
        customerId,
        nome: orc.cliente,
        whatsapp: orc.whatsapp ?? null,
        vendedor: orc.vendedor ?? null,
        origem: "orcamento",
        estagioMinimo: "proposta", // um orçamento enviado = lead em proposta
      });
    }

    const valorNumerico = parseBRL(orc.totalPix ?? orc.totalPrazo);
    const now = new Date();
    const proximoContato = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // D+2
    const status = "ORCAMENTO_ENVIADO";

    await db
      .insert(salesOpportunitiesTable)
      .values({
        lojaId,
        orcamentoId: orc.id,
        customerId,
        leadId,
        cliente: orc.cliente,
        whatsapp: orc.whatsapp ?? null,
        status,
        score,
        closingProbability,
        valorNumerico,
        valorBrl: orc.totalPix ?? orc.totalPrazo ?? null,
        responsavel: orc.vendedor ?? null,
        proximaAcao: deriveProximaAcao(score, status),
        ultimoContatoEm: now,
        proximoContatoEm: proximoContato,
        atualizadoEm: now,
      })
      .onConflictDoUpdate({
        target: [salesOpportunitiesTable.lojaId, salesOpportunitiesTable.orcamentoId],
        set: {
          customerId,
          leadId,
          score,
          closingProbability,
          valorNumerico,
          valorBrl: orc.totalPix ?? orc.totalPrazo ?? null,
          proximaAcao: deriveProximaAcao(score, status),
          atualizadoEm: now,
        },
      });

    await logEvent({
      lojaId,
      entidade: "orcamento",
      entidadeId: String(orc.id),
      acao: "ORCAMENTO_CRIADO",
      payload: { cliente: orc.cliente, valorNumerico, score },
    });
  } catch (err) {
    console.error("[operacoes] ensureOpportunityForOrcamento failed:", err);
  }
}

/** Mark the opportunity tied to an orçamento as won. Best-effort. */
export async function markOpportunityWon(orcamentoId: number, lojaId: number): Promise<void> {
  try {
    const now = new Date();
    const [opp] = await db
      .update(salesOpportunitiesTable)
      .set({ status: "GANHO", proximaAcao: "Concluído", atualizadoEm: now })
      .where(and(eq(salesOpportunitiesTable.orcamentoId, orcamentoId), eq(salesOpportunitiesTable.lojaId, lojaId)))
      .returning({ leadId: salesOpportunitiesTable.leadId });

    // Sincroniza o CRM: lead vinculado também vai para "ganho"
    if (opp?.leadId) {
      await db
        .update(leadsTable)
        .set({ estagio: "ganho", ultimoContato: now, atualizadoEm: now })
        .where(and(eq(leadsTable.id, opp.leadId), eq(leadsTable.lojaId, lojaId)));
    }

    await logEvent({
      lojaId,
      entidade: "orcamento",
      entidadeId: String(orcamentoId),
      acao: "VENDA_FECHADA",
    });
  } catch (err) {
    console.error("[operacoes] markOpportunityWon failed:", err);
  }
}

function daysSince(d: Date | null): number {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
}

/**
 * Central de Operações payload: actionable cards + pipeline + headline numbers.
 * All scoped to lojaId (multi-tenant).
 */
export async function listOperacoes(lojaId: number) {
  const opps = await db
    .select()
    .from(salesOpportunitiesTable)
    .where(and(eq(salesOpportunitiesTable.lojaId, lojaId), ne(salesOpportunitiesTable.status, "GANHO"), ne(salesOpportunitiesTable.status, "PERDIDO")))
    .orderBy(desc(salesOpportunitiesTable.score), desc(salesOpportunitiesTable.criadoEm))
    .limit(200);

  const pipeline = opps.map((o) => {
    const dias = daysSince(o.ultimoContatoEm ?? o.criadoEm);
    return {
      id: o.id,
      orcamentoId: o.orcamentoId,
      customerId: o.customerId,
      cliente: o.cliente,
      whatsapp: o.whatsapp,
      status: o.status,
      score: Math.round(o.score),
      closingProbability: Math.round(o.closingProbability),
      valorNumerico: o.valorNumerico,
      valorBrl: o.valorBrl,
      diasSemResposta: dias,
      proximaAcao: o.proximaAcao,
      responsavel: o.responsavel,
      criadoEm: o.criadoEm,
    };
  });

  const acaoAgora = pipeline.slice(0, 12);

  // Headline widgets derived from the pipeline + a couple of cheap cross-domain reads
  const receitaPrevista = pipeline.reduce((sum, o) => sum + (o.valorNumerico || 0), 0);
  const leadsCriticos = pipeline.filter((o) => o.score >= 90 || o.status === "CRITICO" || o.status === "QUENTE").length;
  const hoje = new Date(); hoje.setHours(23, 59, 59, 999);
  const [{ count: followupsHoje } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salesOpportunitiesTable)
    .where(and(
      eq(salesOpportunitiesTable.lojaId, lojaId),
      ne(salesOpportunitiesTable.status, "GANHO"),
      ne(salesOpportunitiesTable.status, "PERDIDO"),
      lte(salesOpportunitiesTable.proximoContatoEm, hoje),
    ));

  const [{ count: entregasPendentes } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(entregasTable)
    .where(and(eq(entregasTable.lojaId, lojaId), eq(entregasTable.status, "pendente")));

  const [{ count: produtosSemEstoque } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(produtosTable)
    .where(and(eq(produtosTable.lojaId, lojaId), lte(produtosTable.estoque, 0)));

  // Margens críticas: disponíveis com margem < 20% (precisa de custo + preço base preenchidos)
  const [{ count: margensCriticas } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(produtosTable)
    .where(and(
      eq(produtosTable.lojaId, lojaId),
      eq(produtosTable.disponivel, true),
      sql`${produtosTable.factoryCost} > 0 AND ${produtosTable.precoBase} > 0 AND (${produtosTable.precoBase} - ${produtosTable.factoryCost}) / ${produtosTable.precoBase} < 0.20`,
    ));

  return {
    resumo: {
      pipelineTotal: pipeline.length,
      receitaPrevista,
      leadsCriticos,
      followupsHoje: followupsHoje ?? 0,
      entregasPendentes: entregasPendentes ?? 0,
      produtosSemEstoque: produtosSemEstoque ?? 0,
      margensCriticas: margensCriticas ?? 0,
    },
    acaoAgora,
    pipeline,
  };
}

const STATUS_ORDER = [
  "CRITICO", "INTERVENCAO_HUMANA", "QUENTE", "NEGOCIANDO",
  "AGUARDANDO_RESPOSTA", "ORCAMENTO_ENVIADO", "NOVO", "REATIVACAO",
  "GANHO", "PERDIDO",
];

/**
 * Full opportunity pipeline (all statuses) for the Histórico → Pipeline view.
 * Enriches each opportunity with its follow-up counts (reused from `follow_ups`,
 * keyed by orcamentoId). Scoped to lojaId.
 */
export async function listPipeline(lojaId: number) {
  const opps = await db
    .select()
    .from(salesOpportunitiesTable)
    .where(eq(salesOpportunitiesTable.lojaId, lojaId))
    .orderBy(desc(salesOpportunitiesTable.score), desc(salesOpportunitiesTable.criadoEm))
    .limit(500);

  // Follow-up counts per orçamento (reuse existing follow_ups table)
  const fuRows = await db
    .select({
      orcamentoId: followUpsTable.orcamentoId,
      total: sql<number>`count(*)::int`,
      pendentes: sql<number>`sum(case when ${followUpsTable.executadoEm} is null then 1 else 0 end)::int`,
    })
    .from(followUpsTable)
    .where(eq(followUpsTable.lojaId, lojaId))
    .groupBy(followUpsTable.orcamentoId);

  const fuByOrc = new Map(fuRows.map((r) => [r.orcamentoId, r]));

  const opportunities = opps.map((o) => {
    const fu = fuByOrc.get(o.orcamentoId);
    return {
      id: o.id,
      orcamentoId: o.orcamentoId,
      customerId: o.customerId,
      cliente: o.cliente,
      whatsapp: o.whatsapp,
      status: o.status,
      score: Math.round(o.score),
      closingProbability: Math.round(o.closingProbability),
      valorNumerico: o.valorNumerico,
      valorBrl: o.valorBrl,
      diasSemResposta: daysSince(o.ultimoContatoEm ?? o.criadoEm),
      proximaAcao: o.proximaAcao,
      responsavel: o.responsavel,
      criadoEm: o.criadoEm,
      followupsTotal: fu?.total ?? 0,
      followupsPendentes: fu?.pendentes ?? 0,
    };
  });

  const statusCounts: Record<string, number> = {};
  for (const o of opportunities) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  return { statusOrder: STATUS_ORDER, statusCounts, opportunities };
}
