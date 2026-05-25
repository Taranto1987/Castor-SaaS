import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { gerarTextoOrcamento } from "../../../services/orcamento/generator";
import { findProdutosByIds, saveOrcamento } from "../../../services/orcamento/repository";
import { logEvent } from "../../log-event";
import type { ToolContext } from "../context";

export interface CreateOrcamentoInput {
  cliente: string;
  whatsapp?: string;
  produto_ids: number[];
  observacoes?: string;
  desconto_pix?: number;
}

export interface CreateOrcamentoResult {
  orcamento_id: number;
  total_pix: string;
  total_prazo: string;
  parcela_12x: string;
  desconto_aplicado: string;
  texto: string;
  whatsapp_link: string | null;
}

export async function createOrcamento(
  input: CreateOrcamentoInput,
  ctx: ToolContext,
): Promise<CreateOrcamentoResult | { error: string; code: string }> {
  if (!ctx.actorId && ctx.actorType === "usuario") {
    return { error: "Autenticação necessária para criar orçamentos.", code: "UNAUTHORIZED" };
  }

  if (!input.produto_ids.length) {
    return { error: "Informe ao menos um produto.", code: "INVALID_INPUT" };
  }

  const extraDesconto = Math.max(0, Math.min(85, Number(input.desconto_pix) || 0));

  // Fetch products — lojaId filter enforces tenant isolation
  const produtos = await findProdutosByIds(input.produto_ids, ctx.lojaId);

  if (!produtos.length) {
    return { error: "Nenhum produto encontrado para esta loja.", code: "NOT_FOUND" };
  }

  const [loja] = await db
    .select({ whatsappNumero: lojasTable.whatsappNumero, header: lojasTable.nome, wa: lojasTable.whatsappDisplay })
    .from(lojasTable)
    .where(eq(lojasTable.id, ctx.lojaId));

  const gerado = gerarTextoOrcamento(
    {
      cliente: input.cliente,
      whatsapp: input.whatsapp,
      produtoIds: input.produto_ids,
      observacoes: input.observacoes,
      descontoPix: extraDesconto,
      vendedor: ctx.vendedor,
      header: loja?.header,
      wa: loja?.wa ?? undefined,
    },
    produtos,
  );

  const row = await saveOrcamento({
    lojaId: ctx.lojaId,
    cliente: input.cliente,
    whatsapp: input.whatsapp,
    produtosJson: gerado.produtos,
    observacoes: input.observacoes,
    descontoPix: extraDesconto,
    totalPix: gerado.totalPix,
    totalPrazo: gerado.totalPrazo,
    texto: gerado.texto,
    vendedor: ctx.vendedor ?? null,
    precoBaseTotal: gerado.totalPrecoBase,
    descontoAplicado: gerado.descontoAplicado,
  });

  // Audit trail — fire and forget
  logEvent({
    lojaId: ctx.lojaId,
    entidade: "orcamento",
    entidadeId: String(row.id),
    acao: "criado_via_tool",
    atorId: ctx.actorId,
    atorTipo: ctx.actorType,
    payload: {
      cliente: input.cliente,
      produtoCount: produtos.length,
      totalPix: gerado.totalPix,
      extraDesconto,
    },
  }).catch(() => null);

  const waNum = loja?.whatsappNumero?.replace(/\D/g, "");
  const waLink = waNum
    ? `https://wa.me/${waNum}?text=${encodeURIComponent(gerado.texto)}`
    : null;

  return {
    orcamento_id: row.id,
    total_pix: gerado.totalPix,
    total_prazo: gerado.totalPrazo,
    parcela_12x: gerado.parcela12,
    desconto_aplicado: gerado.descontoAplicado,
    texto: gerado.texto,
    whatsapp_link: waLink,
  };
}
