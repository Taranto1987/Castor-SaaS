import { db, leadsTable, leadInteracoesTable, diagnosticosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { resolveOrCreateCustomerByPhone } from "../memory/identity";
import { ensureLeadForCustomer } from "../operacoes/repository";
import { calcularScoreIntencao, classificarLead } from "../../lib/intentScore";
import { logEvent } from "../../lib/log-event";
import { INCOMODO_PARA_MOTIVO, TAMANHOS_VALIDOS, CONJUNTOS_VALIDOS, whatsappBRValido } from "./types";
import { parseLojaIdPayload } from "../../middlewares/auth";

interface MapaSonoResult {
  success: boolean;
  status: number;
  data?: { leadId: number | null; diagnosticoId: number | null };
  error?: string;
}

export async function ingestMapaSonoLead(body: Record<string, unknown>): Promise<MapaSonoResult> {
  const lojaId = parseLojaIdPayload(body.lojaId);
  if (lojaId === null) {
    return { success: false, status: 400, error: "lojaId é obrigatório" };
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  if (!nome) {
    return { success: false, status: 400, error: "Nome é obrigatório" };
  }

  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.replace(/\D/g, "") : "";
  if (!whatsappBRValido(whatsapp)) {
    return { success: false, status: 400, error: "WhatsApp inválido (formato BR com DDD)" };
  }

  if (body.origem !== "mapa_sono" && body.origem !== "mapa_do_sono") {
    return { success: false, status: 400, error: "origem inválida" };
  }

  const tamanho = typeof body.tamanho === "string" && (TAMANHOS_VALIDOS as readonly string[]).includes(body.tamanho)
    ? body.tamanho : null;
  const conjunto = typeof body.conjunto === "string" && (CONJUNTOS_VALIDOS as readonly string[]).includes(body.conjunto)
    ? body.conjunto : null;
  if (!tamanho || !conjunto) {
    return { success: false, status: 400, error: "tamanho e conjunto são obrigatórios" };
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

  const customerId = await resolveOrCreateCustomerByPhone(whatsapp, nome, lojaId);
  const leadId = await ensureLeadForCustomer({
    lojaId,
    customerId,
    nome,
    whatsapp,
    origem: "mapa_sono",
    estagioMinimo: "contato",
  });

  if (leadId) {
    const incomodo = typeof perfil.incomodo === "string" ? perfil.incomodo : "";
    const scoreIntencao = calcularScoreIntencao({
      motivoTroca: INCOMODO_PARA_MOTIVO[incomodo],
    });
    const classificacao = classificarLead(scoreIntencao);
    const dores = Array.isArray(perfil.dores) ? (perfil.dores as string[]) : [];
    const firmezaIndicada = typeof resultado.firmezaIndicada === "string" ? resultado.firmezaIndicada : null;

    await db
      .update(leadsTable)
      .set({
        perfilBiomecanico: {
          pesoA: typeof perfil.pesoA === "number" ? perfil.pesoA : null,
          pesoB: typeof perfil.pesoB === "number" ? perfil.pesoB : null,
          posicao: perfil.posicao ?? null,
          temperatura: perfil.calor === true ? "sim" : "nao",
          dores,
          casal: perfil.ocupacao === "casal" ? "casal" : "sozinho",
          incomodo: incomodo || null,
          tamanho,
          conjunto,
          firmeza: firmezaIndicada,
          produto_recomendado: typeof top?.nome === "string" ? top.nome : null,
          compatibilidade: typeof top?.score === "number" ? top.score : null,
        },
        scoreIntencao,
        statusFunil: "whatsapp_aberto",
        ultimoContato: new Date(),
        atualizadoEm: new Date(),
      })
      .where(and(eq(leadsTable.id, leadId), eq(leadsTable.lojaId, lojaId)));

    const linhas = [
      `🌙 Mapa do Sono 2.0 — lead com WhatsApp aberto`,
      ``,
      typeof top?.nome === "string"
        ? `Maior compatibilidade: ${top.nome} (${typeof top.score === "number" ? top.score : "—"}%)`
        : `Sem produto elegível — atendimento de especialista`,
      `Score de intenção: ${scoreIntencao}/100 — ${classificacao.label}`,
      ``,
      `Perfil: ${typeof resultado.perfilResumo === "string" && resultado.perfilResumo ? resultado.perfilResumo : "—"}`,
      `Tamanho: ${tamanho} · Conjunto: ${conjunto.replace(/_/g, " + ")}`,
    ];
    if (ranking.length > 1) {
      const outros = ranking.slice(1)
        .map((r) => {
          const item = r as Record<string, unknown>;
          return `${item.nome} (${item.score}%)`;
        })
        .join(" · ");
      linhas.push(`Alternativas: ${outros}`);
    }

    await db.insert(leadInteracoesTable).values({
      leadId,
      lojaId,
      tipo: "handoff",
      autorNome: "Mapa do Sono IA",
      conteudo: linhas.join("\n"),
    });
  }

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

  return { success: true, status: 201, data: { leadId, diagnosticoId: diag?.id ?? null } };
}
