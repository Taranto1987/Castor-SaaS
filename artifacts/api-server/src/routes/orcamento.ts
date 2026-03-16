import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/", async (req, res) => {
  try {
    const { cliente, produtoId, observacoes } = req.body;

    if (!cliente || !produtoId) {
      res.status(400).json({ error: "Cliente e produtoId são obrigatórios" });
      return;
    }

    const results = await db.select().from(produtosTable).where(eq(produtosTable.id, parseInt(produtoId))).limit(1);
    if (results.length === 0) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }

    const p = results[0];

    const linhas: string[] = [
      "━━━━━━━━━━━━━━━━━━━━━━━",
      "🛏️ CASTOR CABO FRIO",
      "━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `👤 Cliente: ${cliente}`,
      "",
      `📦 Produto:`,
      `${p.nome}`,
    ];

    if (p.medidas) linhas.push(`📐 Medidas: ${p.medidas}`);
    if (p.altura) linhas.push(`📏 Altura: ${p.altura}`);
    if (p.sku) linhas.push(`🔖 Ref: ${p.sku}`);

    linhas.push("");
    linhas.push("💰 Valores:");

    if (p.preco) linhas.push(`• Preço: ${p.preco}`);
    if (p.precoPix) linhas.push(`• Pix: ${p.precoPix} ✅`);
    if (p.parcelamento) linhas.push(`• Parcelado: ${p.parcelamento}`);

    if (observacoes) {
      linhas.push("");
      linhas.push(`📝 Obs: ${observacoes}`);
    }

    linhas.push("");
    linhas.push("📞 (22) 99241-0112");
    linhas.push("━━━━━━━━━━━━━━━━━━━━━━━");

    const texto = linhas.join("\n");

    res.json({
      texto,
      produto: {
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
      }
    });
  } catch (error) {
    console.error("Erro ao gerar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
