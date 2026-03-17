import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { produtosTable, orcamentosTable } from "@workspace/db/schema";
import { inArray, desc } from "drizzle-orm";

const router: IRouter = Router();

function parsarPreco(valor?: string | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

router.post("/", async (req, res) => {
  try {
    const { cliente, whatsapp, produtoIds, observacoes, descontoPix = 0 } = req.body;

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

    const desconto = Math.max(0, Math.min(100, Number(descontoPix) || 0));

    let totalPixBruto = 0;
    let totalPrazo = 0;

    const listaProdutos = ordenados.map((p, i) => {
      const pix = parsarPreco(p.precoPix);
      const prazo = parsarPreco(p.preco);
      totalPixBruto += pix;
      totalPrazo += prazo;

      const linhas: string[] = [`${i + 1}️⃣ ${p.nome}`];
      if (p.medidas) linhas.push(`📐 Medidas: ${p.medidas}`);
      if (p.altura) linhas.push(`📏 Altura: ${p.altura}`);
      if (p.sku) linhas.push(`🔖 Ref: ${p.sku}`);
      if (p.precoPix) linhas.push(`💰 Pix: ${p.precoPix}`);
      if (p.preco) linhas.push(`💳 Prazo: ${p.preco}`);

      return linhas.join("\n");
    });

    const totalPix = desconto > 0
      ? totalPixBruto * (1 - desconto / 100)
      : totalPixBruto;

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
    ];

    if (desconto > 0) {
      linhas.push(`💰 PIX (${desconto}% de desconto)`);
      linhas.push(`~~R$ ${totalPixBruto.toFixed(2)}~~`);
      linhas.push(`➡️ R$ ${totalPix.toFixed(2)}`);
    } else {
      linhas.push("💰 PIX");
      linhas.push(`R$ ${totalPix.toFixed(2)}`);
    }

    linhas.push("");
    linhas.push("💳 Parcelado");
    linhas.push(`R$ ${totalPrazo.toFixed(2)}`);
    linhas.push("");
    linhas.push("ou");
    linhas.push("");
    linhas.push(`12x de R$ ${parcela12.toFixed(2)}`);
    linhas.push("");
    linhas.push("━━━━━━━━━━━━━━━━━━━━━━");

    if (observacoes) {
      linhas.push("");
      linhas.push("Observações:");
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
      totalPix: totalPix.toFixed(2),
      totalPrazo: totalPrazo.toFixed(2),
      parcela12: parcela12.toFixed(2),
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

router.post("/salvar", async (req, res) => {
  try {
    const { cliente, whatsapp, produtosJson, observacoes, descontoPix, totalPix, totalPrazo, texto, vendedor } = req.body;

    if (!cliente || !texto) {
      res.status(400).json({ error: "Dados insuficientes para salvar" });
      return;
    }

    const inserted = await db.insert(orcamentosTable).values({
      cliente,
      whatsapp: whatsapp || null,
      produtosJson: produtosJson || [],
      observacoes: observacoes || null,
      descontoPix: descontoPix || 0,
      totalPix: totalPix || null,
      totalPrazo: totalPrazo || null,
      texto,
      vendedor: vendedor || null,
    }).returning();

    res.json({ id: inserted[0].id, mensagem: "Orçamento salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/historico", async (req, res) => {
  try {
    const historico = await db.select().from(orcamentosTable).orderBy(desc(orcamentosTable.criadoEm)).limit(50);
    res.json(historico);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
