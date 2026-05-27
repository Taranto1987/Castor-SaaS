import { db } from "@workspace/db";
import { orcamentosTable, followUpsTable, leadScoresTable } from "@workspace/db/schema";
import { eq, and, lte, isNull, lt, gt } from "drizzle-orm";
import { enviarWhatsApp } from "../services/whatsapp";
import { computeScore, type StoredSignals } from "../services/scoring/engine";

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
    case "dia3":
      return `Oi ${nome}! 👋 Aqui é ${remetente} da Castor Exclusiva.\n\nPassei pra ver se ficou com alguma dúvida sobre o ${produtos}${valor} que te apresentei. Está disponível e posso fechar hoje! 😊`;
    case "dia7":
      return `Oi ${nome}! ${remetente} da Castor aqui. 🛏️\n\nO orçamento do ${produtos}${valor} ainda está em aberto. Estoque é limitado e não quero que você perca essa condição. Podemos finalizar? ✅`;
    case "dia14":
      return `Oi ${nome}, tudo bem? ${remetente} da Castor.\n\nSeu orçamento${valor} está prestes a expirar. Quer garantir o preço especial ainda? Me avisa que finalizo agora! 🙏`;
    default:
      return `Oi ${nome}! ${remetente} da Castor. Passando pra dar um alô sobre seu orçamento${valor}. Posso ajudar? 😊`;
  }
}

const JANELAS = [
  { tipo: "dia3",  minDias: 3,  maxDias: 6  },
  { tipo: "dia7",  minDias: 7,  maxDias: 13 },
  { tipo: "dia14", minDias: 14, maxDias: 45 },
];

async function ciclo(): Promise<void> {
  const agora = new Date();

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

      console.log(`[FollowUp] Gerado ${janela.tipo} para orçamento #${orc.id} (${orc.cliente})`);
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
      console.log(`[FollowUp] Enviado ${fu.tipo} → ${tel} (orçamento #${fu.orcamentoId})`);
    } catch (err) {
      // WAHA offline ou não configurado — será tentado no próximo ciclo
      console.error(`[FollowUp] Falha ao enviar ${fu.tipo} para #${fu.orcamentoId}:`, err);
    }
  }
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

export function iniciarSchedulerFollowUps(): void {
  _cicloRunning = true;
  ciclo()
    .catch((err) => console.error("[FollowUp] Erro no ciclo inicial:", err))
    .finally(() => { _cicloRunning = false; });
  cicloScoreDecay().catch((err) => console.error("[ScoreDecay] Erro inicial:", err));

  const MS_6H = 6 * 60 * 60 * 1000;
  _followUpHandle = setInterval(() => {
    if (_cicloRunning) {
      console.warn("[FollowUp] Ciclo anterior ainda rodando — pulando tick");
      return;
    }
    _cicloRunning = true;
    ciclo()
      .catch((err) => console.error("[FollowUp] Erro no ciclo:", err))
      .finally(() => { _cicloRunning = false; });
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
