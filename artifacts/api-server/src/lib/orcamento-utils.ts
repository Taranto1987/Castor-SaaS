import { db } from "@workspace/db";
import { produtosTable, orcamentosTable } from "@workspace/db/schema";
import { inArray, and, eq } from "drizzle-orm";
import { parseBRL as parsarPreco, formatBRL } from "../services/shared/currency";

export { parsarPreco, formatBRL };

export const BENEFICIO_CATEGORIA: Record<string, string> = {
  "colchoes":         "🌙 Engenharia do sono — conforto e saúde para sua noite",
  "cama-box":         "🏠 Base de qualidade — sustentação ideal para seu colchão",
  "cama-box-colchao": "🌙 Conjunto completo — colchão + base em uma só compra",
  "travesseiros":     "💤 Suporte perfeito para pescoço e coluna",
  "roupa-de-cama":    "✨ Proteção e conforto para seu investimento",
  "protetor":         "🛡️ Proteção total — mantém a garantia do colchão",
};

export const BENEFICIO_DEFAULT = "✨ Qualidade Castor — fabricante líder em sono saudável";

/**
 * Gera e salva orçamento automaticamente a partir de dados extraídos do chat.
 * Usa dados reais do banco — nunca inventa preço ou produto.
 * Retorna o ID do orçamento criado, ou null se não for possível.
 */
export async function autoSalvarOrcamentoDaConversa(
  nomeCliente: string,
  telefone: string,
  produtoIds: number[],
  lojaId: number,
): Promise<number | null> {
  if (!nomeCliente?.trim() || !telefone?.trim() || !produtoIds?.length) {
    console.warn("[AutoSave] Dados insuficientes:", { nomeCliente, telefone, produtoIds: produtoIds?.length });
    return null;
  }

  try {
    const ids = produtoIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
    if (ids.length === 0) {
      console.warn("[AutoSave] Nenhum ID válido em:", produtoIds);
      return null;
    }

    const produtos = await db
      .select()
      .from(produtosTable)
      .where(and(inArray(produtosTable.id, ids), eq(produtosTable.lojaId, lojaId)));

    if (produtos.length === 0) {
      console.warn("[AutoSave] Nenhum produto encontrado para IDs:", ids, "lojaId:", lojaId);
      return null;
    }

    let totalBase = 0;
    const listaNomes: string[] = [];

    for (const p of produtos) {
      const base = p.precoBase
        ? parseFloat(String(p.precoBase))
        : parsarPreco(p.preco);
      totalBase += base;
      listaNomes.push(p.nome);
    }

    if (totalBase === 0) return null;

    const totalPix = totalBase * 0.85;
    const parcela12 = totalBase / 12;
    const nomeProdutos = listaNomes.join(", ");

    const linhas = [
      "━━━━━━━━━━━━━━━━━━━━━━",
      "🤖 ORÇAMENTO VIA CHAT THALESZZZ",
      "━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `Cliente: ${nomeCliente}`,
      `WhatsApp: ${telefone}`,
      "",
      `Produtos: ${nomeProdutos}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━",
      `De: ~${formatBRL(totalBase)}~`,
      `💰 PIX: *${formatBRL(totalPix)}* (15% de desconto)`,
      `💳 Parcelado: ${formatBRL(totalBase)} — 12x de ${formatBRL(parcela12)}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "👉 Gerado automaticamente pelo ThallesZzz. Confirme com o cliente pelo WhatsApp.",
    ];

    const texto = linhas.join("\n");

    const [inserted] = await db
      .insert(orcamentosTable)
      .values({
        lojaId,
        cliente: nomeCliente.trim(),
        whatsapp: telefone.trim(),
        produtosJson: produtos.map((p) => ({ id: p.id, nome: p.nome })),
        descontoPix: 0,
        totalPix: formatBRL(totalPix),
        totalPrazo: formatBRL(totalBase),
        texto,
        vendedor: "ThallesZzz",
        status: "pendente",
        precoBaseTotal: formatBRL(totalBase),
        descontoAplicado: formatBRL(totalBase - totalPix),
      })
      .returning({ id: orcamentosTable.id });

    console.log(`[AutoSave] Orçamento #${inserted.id} salvo — ${nomeCliente} / ${nomeProdutos}`);
    return inserted.id;
  } catch (err) {
    console.error("[AutoSave] Erro ao salvar orçamento da conversa:", err);
    return null;
  }
}
