import { db } from "@workspace/db";
import { orcamentosTable, followUpsTable, leadScoresTable, salesOpportunitiesTable } from "@workspace/db/schema";
import { eq, and, lte, isNull, lt, gt, ne } from "drizzle-orm";
import { enviarWhatsApp } from "../services/whatsapp";
import { computeScore, type StoredSignals } from "../services/scoring/engine";
import { logEvent } from "./log-event";
import { logger } from "./logger";

function sanitizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto;
}

function gerarMensagem(
  tipo: string,
  cliente: string,
  produtos: string,
  totalPix: string | null,
  vendedor: string | null
): string {
  const nome = primeiroNome(cliente);
  const valor = totalPix ? ` de ${totalPix}` : "";
  const remetente = vendedor && vendedor !== "ThallesZzz" ? vendedor : "Equipe Castor";

  switch (tipo) {
    case "FOLLOWUP_D2":
      return `Oi ${nome}! 👋 Aqui é ${remetente} da Castor Exclusiva.\n\nPassei pra ver se ficou com alguma dúvida sobre o ${produtos}${valor} que te apresentei. Está disponível e posso fechar hoje! 😊`;
    case "FOLLOWUP_D5":
      return `Oi ${nome}! ${remetente} da Castor aqui. 🛏️\n\nO orçamento do ${produtos}${valor} ainda está em aberto. Estoque é limitado e não quero que você perca essa condição. Podemos finalizar? ✅`;
    case "FOLLOWUP_D10":
      return `Oi ${nome}, tudo bem? ${remetente} da Castor.\n\nSeu orçamento${valor} está prestes a expirar. Quer garantir o preço especial ainda? Me avisa que finalizo agora! 🙏`;
    case "REATIVACAO_D30":
      return `Oi ${nome}! ${remetente} da Castor. 🌙\n\nFaz um tempinho que conversamos sobre o ${produtos}. Surgiu uma condição nova essa semana e lembrei de você. Quer que eu te mande? 😊`;
    case "RECUPERACAO_D60":
      return `Oi ${nome}! ${remetente} da Castor.\n\nReservei uma oferta especial pra fechar seu ${produtos}${valor}. É por tempo limitado — posso te passar os detalhes? 🎁`;
    default:
      return `Oi ${nome}! ${remetente} da Castor. Passando pra dar um alô sobre seu orçamento${valor}. Posso ajudar? 😊`;
  }
}

// Cadência COCA: gatilhos por dias sem resposta sobre orçamento em aberto.
const JANELAS = [
  { tipo: "FOLLOWUP_D2",     minDias: 2,  maxDias: 4   },
  { tipo: "FOLLOWUP_D5",     minDias: 5,  maxDias: 9   },
  { tipo: "FOLLOWUP_D10",    minDias: 10, maxDias: 29  },
  { tipo: "REATIVACAO_D30",  minDias: 30, maxDias: 59  },
  { tipo: "RECUPERACAO_D60", minDias: 60, maxDias: 120 },
];

// Cada estágio da cadência avança o estado da oportunidade (pipeline) e emite evento.
const CADENCIA: Record<string, { status: string; acao: string; evento: string }> = {
  FOLLOWUP_D2:     { status: "AGUARDANDO_RESPOSTA", acao: "WhatsApp Automático", evento: "FOLLOWUP_GERADO" },
  FOLLOWUP_D5:     { status: "AGUARDANDO_RESPOSTA", acao: "Ligar",              evento: "FOLLOWUP_GERADO" },
  FOLLOWUP_D10:    { status: "INTERVENCAO_HUMANA",  acao: "Intervenção Humana", evento: "FOLLOWUP_GERADO" },
  REATIVACAO_D30:  { status: "REATIVACAO",          acao: "Reativar cliente",   evento: "REATIVACAO_INICIADA" },
  RECUPERACAO_D60: { status: "REATIVACAO",          acao: "Recuperação",        evento: "REATIVACAO_INICIADA" },
};

/** Avança o estado da oportunidade conforme o estágio da cadência e registra o evento. */
async function avancarOportunidade(orcamentoId: number, lojaId: number, tipo: string): Promise<void> {
  const c = CADENCIA[tipo];
  if (!c) return;
  try {
    await db
      .update(salesOpportunitiesTable)
      .set({ status: c.status, proximaAcao: c.acao, atualizadoEm: new Date() })
      .where(and(
        eq(salesOpportunitiesTable.orcamentoId, orcamentoId),
        eq(salesOpportunitiesTable.lojaId, lojaId),
        ne(salesOpportunitiesTable.status, "GANHO"),
        ne(salesOpportunitiesTable.status, "PERDIDO"),
      ));
  } catch (err) {
    logger.error({ err, orcamentoId, tipo }, "followup_opportunity_sync_failed");
  }
  await logEvent({ lojaId, entidade: "orcamento", entidadeId: String(orcamentoId), acao: c.evento, payload: { tipo } });
}

async function ciclo(): Promise<{ geradas: number; enviados: number }> {
  const agora = new Date();
  let geradas = 0;
  let enviados = 0;

  // ── 1. Gerar follow-ups que ainda não existem ────────────────────────────
  for (const janela of JANELAS) {
    const corte = new Date(agora);
    corte.setDate(corte.getDate() - janela.minDias);

    const orcamentos = await db
      .select()
      .from(orcamentosTable)
      .where(and(eq(orcamentosTable.status, "pendente"), lte(orcamentosTable.criadoEm, corte)));

    for (const orc of orcamentos) {
      if (!orc.criadoEm) continue;
      const diasDesde = Math.floor((agora.getTime() - new Date(orc.criadoEm).getTime()) / 86_400_000);
      if (diasDesde < janela.minDias || diasDesde > janela.maxDias) continue;

      const existente = await db
        .select({ id: followUpsTable.id })
        .from(followUpsTable)
        .where(and(eq(followUpsTable.orcamentoId, orc.id), eq(followUpsTable.tipo, janela.tipo)))
        .limit(1);

      if (existente.length > 0) continue;

      interface ProdutoItem { nome?: string }
      const prodItems = Array.isArray(orc.produtosJson) ? orc.produtosJson as ProdutoItem[] : [];
      const produtos = prodItems.map((p) => p.nome).filter(Boolean).join(", ") || "o produto";
      const mensagem = gerarMensagem(janela.tipo, orc.cliente, produtos, orc.totalPix, orc.vendedor);
      const tel = sanitizarTelefone(orc.whatsapp);
      const waLink = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}` : null;

      await db.insert(followUpsTable).values({
        lojaId: orc.lojaId ?? 1,
        orcamentoId: orc.id,
        tipo: janela.tipo,
        mensagem,
        waLink,
      });

      // COCA: avança o estado da oportunidade e registra o evento da cadência
      await avancarOportunidade(orc.id, orc.lojaId ?? 1, janela.tipo);

      geradas++;
    }
  }

  // ── 2. Enviar via WAHA os que ainda não foram enviados ──────────────────
  const pendentes = await db
    .select()
    .from(followUpsTable)
    .where(isNull(followUpsTable.executadoEm));

  for (const fu of pendentes) {
    const [orc] = await db
      .select({ whatsapp: orcamentosTable.whatsapp, status: orcamentosTable.status })
      .from(orcamentosTable)
      .where(eq(orcamentosTable.id, fu.orcamentoId))
      .limit(1);

    // Não enviar se o orçamento já foi vendido/cancelado entre a geração e o envio
    if (!orc || orc.status !== "pendente") {
      await db.update(followUpsTable).set({ executadoEm: new Date() }).where(eq(followUpsTable.id, fu.id));
      continue;
    }

    const tel = sanitizarTelefone(orc.whatsapp);
    if (!tel) continue;

    try {
      await enviarWhatsApp(tel, fu.mensagem);
      await db.update(followUpsTable).set({ executadoEm: new Date() }).where(eq(followUpsTable.id, fu.id));
      await logEvent({
        lojaId: fu.lojaId ?? 1,
        entidade: "orcamento",
        entidadeId: String(fu.orcamentoId),
        acao: "FOLLOWUP_ENVIADO",
        payload: { tipo: fu.tipo },
      });
      enviados++;
    } catch (err) {
      // WAHA offline ou não configurado — será tentado no próximo ciclo
      logger.error({ err, tipo: fu.tipo, orcamentoId: fu.orcamentoId }, "followup_send_failed");
    }
  }

  return { geradas, enviados };
}

async function cicloScoreDecay(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  const rows = await db.select().from(leadScoresTable)
    .where(and(lt(leadScoresTable.lastSeenAt, cutoff), gt(leadScoresTable.score, 0)));

  for (const row of rows) {
    const result = computeScore(
      (row.signals ?? {}) as StoredSignals,
      row.score ?? 0,
      row.sessionCount ?? 1,
      row.lastSeenAt ?? new Date(),
    );
    if (result.score !== row.score) {
      await db
        .update(leadScoresTable)
        .set({ score: result.score, category: result.category, atualizadoEm: new Date() })
        .where(eq(leadScoresTable.id, row.id));
    }
  }
}

let _followUpHandle: ReturnType<typeof setInterval> | null = null;
let _decayHandle: ReturnType<typeof setInterval> | null = null;
let _cicloRunning = false;

function runCiclo() {
  const t0 = Date.now();
  _cicloRunning = true;
  ciclo()
    .then((stats) => {
      logger.info({ scheduler: "followup", durationMs: Date.now() - t0, ...stats }, "scheduler_cycle_complete");
    })
    .catch((err) => logger.error({ err, scheduler: "followup" }, "scheduler_cycle_error"))
    .finally(() => { _cicloRunning = false; });
}

export function iniciarSchedulerFollowUps(): void {
  runCiclo();
  cicloScoreDecay().catch((err) => logger.error({ err }, "score_decay_error"));

  const MS_6H = 6 * 60 * 60 * 1000;
  _followUpHandle = setInterval(() => {
    if (_cicloRunning) {
      logger.warn({ scheduler: "followup" }, "cycle_skipped_previous_running");
      return;
    }
    runCiclo();
  }, MS_6H);

  const MS_24H = 24 * 60 * 60 * 1000;
  _decayHandle = setInterval(() => {
    cicloScoreDecay().catch((err) => console.error("[ScoreDecay] Erro:", err));
  }, MS_24H);
}

export function stopSchedulerFollowUps(): void {
  if (_followUpHandle) { clearInterval(_followUpHandle); _followUpHandle = null; }
  if (_decayHandle) { clearInterval(_decayHandle); _decayHandle = null; }
}
