import { parseBRL, formatBRL } from "../shared/currency";
import { BENEFICIO_CATEGORIA, BENEFICIO_DEFAULT, type OrcamentoGerado, type OrcamentoInput, type ProdutoLinha } from "./types";

interface ProdutoRaw {
  id: number;
  nome: string;
  sku?: string | null;
  preco?: string | null;
  precoPix?: string | null;
  precoBase?: string | number | null;
  parcelamento?: string | null;
  medidas?: string | null;
  altura?: string | null;
  categoria: string;
  imagem?: string | null;
  link?: string | null;
  criadoEm?: Date | null;
}

export function gerarTextoOrcamento(
  input: OrcamentoInput,
  produtos: ProdutoRaw[]
): OrcamentoGerado {
  const extraDesconto = Math.max(0, Math.min(85, Number(input.descontoPix) || 0));
  const totalDescontoPct = 15 + extraDesconto;

  let totalPrecoBase = 0;

  const listaProdutos = produtos.map((p, i) => {
    const precoBaseNum = p.precoBase
      ? parseFloat(String(p.precoBase))
      : parseBRL(p.preco);
    totalPrecoBase += precoBaseNum;

    const precoPixProduto = precoBaseNum * (1 - totalDescontoPct / 100);
    const beneficio = BENEFICIO_CATEGORIA[p.categoria] || BENEFICIO_DEFAULT;

    const linhas: string[] = [`${i + 1}️⃣ *${p.nome}*`, beneficio, ""];
    const dimensoes = [p.medidas, p.altura].filter(Boolean).join(" | ");
    if (dimensoes) linhas.push(`📐 ${dimensoes}`);
    linhas.push("");
    linhas.push(`De: ~${formatBRL(precoBaseNum)}~`);
    linhas.push(`💰 PIX: *${formatBRL(precoPixProduto)}* (${totalDescontoPct}% de desconto)`);
    linhas.push(`💳 Parcelado: ${formatBRL(precoBaseNum)} — 12x de ${formatBRL(precoBaseNum / 12)}`);
    return linhas.join("\n");
  });

  const totalPixFinal = totalPrecoBase * (1 - totalDescontoPct / 100);
  const totalDescontoValor = totalPrecoBase - totalPixFinal;
  const parcela12 = totalPrecoBase / 12;

  const header = input.header ?? "🇧🇷 CASTOR CABO FRIO";
  const wa = input.wa ?? "(22) 99241-0112";

  const linhas: string[] = [
    "━━━━━━━━━━━━━━━━━━━━━━",
    header,
    "━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `Cliente: ${input.cliente}`,
    "",
    "Produtos Selecionados:",
    "",
    listaProdutos.join("\n\n"),
    "",
    "━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "RESUMO DO PEDIDO",
    "",
    `Preço cheio: ~${formatBRL(totalPrecoBase)}~`,
    "",
    extraDesconto > 0 ? `💰 PIX (${totalDescontoPct}% de desconto sobre preço cheio)` : "💰 PIX (15% de desconto)",
    `*${formatBRL(totalPixFinal)}*`,
    "",
    "💳 Parcelado (sem juros)",
    `*${formatBRL(totalPrecoBase)}* — 12x de *${formatBRL(parcela12)}*`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━",
  ];

  if (input.observacoes) {
    linhas.push("", "📋 Observações:", input.observacoes, "", "━━━━━━━━━━━━━━━━━━━━━━");
  }

  linhas.push("", "👉 Gostou? Me confirma um *quero* e finalizo tudo agora pelo WhatsApp! 🛏️✨", "", "━━━━━━━━━━━━━━━━━━━━━━", "", "📞 WhatsApp Loja", wa);

  const produtosLinha: ProdutoLinha[] = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    sku: p.sku,
    preco: p.preco,
    precoPix: p.precoPix,
    precoBase: p.precoBase ? parseFloat(String(p.precoBase)) : parseBRL(p.preco),
    parcelamento: p.parcelamento,
    medidas: p.medidas,
    altura: p.altura,
    categoria: p.categoria,
    imagem: p.imagem,
    link: p.link,
    criadoEm: p.criadoEm,
  }));

  return {
    texto: linhas.join("\n"),
    totalPrecoBase: formatBRL(totalPrecoBase),
    totalPix: formatBRL(totalPixFinal),
    totalPrazo: formatBRL(totalPrecoBase),
    parcela12: formatBRL(parcela12),
    descontoAplicado: formatBRL(totalDescontoValor),
    descontoPercentual: totalDescontoPct,
    produtos: produtosLinha,
  };
}
