import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

const router: IRouter = Router();

function parsarPreco(valor?: string | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function extrairParcela(parcelamento?: string | null): number {
  if (!parcelamento) return 0;
  const match = parcelamento.match(/[\d]+[,.][\d]+/);
  if (!match) return 0;
  const num = parseFloat(match[0].replace(",", "."));
  return isNaN(num) ? 0 : num;
}

router.post("/", async (req, res) => {
  try {
    const { cliente, produtoIds, observacoes } = req.body;

    if (!cliente || !produtoIds || !Array.isArray(produtoIds) || produtoIds.length === 0) {
      res.status(400).json({ error: "Cliente e pelo menos um produto são obrigatórios" });
      return;
    }

    const ids = produtoIds.map((id: unknown) => parseInt(String(id)));
    const results = await db.select().from(produtosTable).where(inArray(produtosTable.id, ids));

    if (results.length === 0) {
      res.status(404).json({ error: "Nenhum produto encontrado" });
      return;
    }

    const ordenados = ids.map(id => results.find(p => p.id === id)).filter(Boolean) as typeof results;

    let totalPix = 0;
    let totalPrazo = 0;

    const listaProdutos = ordenados.map((p, i) => {
      const pix = parsarPreco(p.precoPix);
      const prazo = parsarPreco(p.preco);
      totalPix += pix;
      totalPrazo += prazo;

      const linhas: string[] = [
        `${i + 1}️⃣ ${p.nome}`,
      ];
      if (p.medidas) linhas.push(`📐 Medidas: ${p.medidas}`);
      if (p.altura) linhas.push(`📏 Altura: ${p.altura}`);
      if (p.sku) linhas.push(`🔖 Ref: ${p.sku}`);
      if (p.precoPix) linhas.push(`💰 Pix: ${p.precoPix}`);
      if (p.preco) linhas.push(`💳 Prazo: ${p.preco}`);

      return linhas.join("\n");
    });

    const parcela12 = totalPrazo / 12;

    const linhas: string[] = [
      "━━━━━━━━━━━━━━━━━━━━━━",
      "🇧🇷 CASTOR CABO FRIO",
      "━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `Cliente: ${cliente}`,
      "",
      "Produtos Selecionados:",
      "",
      listaProdutos.join("\n\n"),
      "",
      "━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "Valor Total:",
      "",
      "💰 PIX",
      `R$ ${totalPix.toFixed(2)}`,
      "",
      "💳 Parcelado",
      `R$ ${totalPrazo.toFixed(2)}`,
      "",
      "ou",
      "",
      `12x de R$ ${parcela12.toFixed(2)}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━",
    ];

    if (observacoes) {
      linhas.push("");
      linhas.push(`Observações:`);
      linhas.push(observacoes);
      linhas.push("");
      linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
    }

    linhas.push("");
    linhas.push("📞 WhatsApp Loja");
    linhas.push("(22) 99241-0112");

    const texto = linhas.join("\n");

    res.json({
      texto,
      produtos: ordenados.map(p => ({
        id: p.id,
        nome: p.nome,
        sku: p.sku,
        preco: p.preco,
        precoPix: p.precoPix,
        parcelamento: p.parcelamento,
        medidas: p.medidas,
        altura: p.altura,
        categoria: p.categoria,
        imagem: p.imagem,
        link: p.link,
        criadoEm: p.criadoEm,
      }))
    });
  } catch (error) {
    console.error("Erro ao gerar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
