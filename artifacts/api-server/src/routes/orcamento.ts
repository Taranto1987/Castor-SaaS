import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { produtosTable, orcamentosTable, entregasTable } from "@workspace/db/schema";
import { inArray, desc, eq } from "drizzle-orm";
import { getSession } from "../lib/sessions";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Autenticação necessária" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  (req as any).session = session;
  next();
}

const router: IRouter = Router();

function parsarPreco(valor?: string | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      linhas.push(`~~${formatBRL(totalPixBruto)}~~`);
      linhas.push(`➡️ ${formatBRL(totalPix)}`);
    } else {
      linhas.push("💰 PIX");
      linhas.push(formatBRL(totalPix));
    }

    linhas.push("");
    linhas.push("💳 Parcelado");
    linhas.push(formatBRL(totalPrazo));
    linhas.push("");
    linhas.push("ou");
    linhas.push("");
    linhas.push(`12x de ${formatBRL(parcela12)}`);
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
      totalPix: formatBRL(totalPix),
      totalPrazo: formatBRL(totalPrazo),
      parcela12: formatBRL(parcela12),
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
      status: "pendente",
    }).returning();

    res.json({ id: inserted[0].id, mensagem: "Orçamento salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/historico", requireAuth, async (req, res) => {
  try {
    const session = (req as any).session as { nome: string; papel: string };

    let query = db.select().from(orcamentosTable).orderBy(desc(orcamentosTable.criadoEm)).limit(200);

    if (session.papel !== "dono") {
      query = db.select().from(orcamentosTable)
        .where(eq(orcamentosTable.vendedor, session.nome))
        .orderBy(desc(orcamentosTable.criadoEm))
        .limit(200);
    }

    const historico = await query;
    res.json(historico);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Fechar venda: marca orçamento como vendido e cria entrega ──────────────
router.post("/:id/fechar", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { endereco, observacoes, dataEntrega } = req.body;

    if (!id || isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [orc] = await db.select().from(orcamentosTable).where(eq(orcamentosTable.id, id));
    if (!orc) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    if (orc.status === "vendido") {
      res.status(409).json({ error: "Orçamento já foi fechado como venda" });
      return;
    }

    interface ProdutoItem { id?: number; nome?: string }
    const produtosJson: ProdutoItem[] = Array.isArray(orc.produtosJson)
      ? (orc.produtosJson as ProdutoItem[])
      : [];

    const qtdPorId = new Map<number, number>();
    for (const p of produtosJson) {
      if (p.id) qtdPorId.set(p.id, (qtdPorId.get(p.id) || 0) + 1);
    }

    const produtos = produtosJson.map((p) => p.nome).filter(Boolean).join(", ");

    const result = await db.transaction(async (tx) => {
      await tx.update(orcamentosTable)
        .set({ status: "vendido" })
        .where(eq(orcamentosTable.id, id));

      if (qtdPorId.size > 0) {
        const prods = await tx.select().from(produtosTable).where(inArray(produtosTable.id, [...qtdPorId.keys()]));
        for (const prod of prods) {
          if (prod.estoque !== null && prod.estoque > 0) {
            const qty = qtdPorId.get(prod.id) || 1;
            const novoEstoque = Math.max(0, prod.estoque - qty);
            await tx.update(produtosTable)
              .set({ estoque: novoEstoque, disponivel: novoEstoque > 0 })
              .where(eq(produtosTable.id, prod.id));
          }
        }
      }

      const [entrega] = await tx.insert(entregasTable).values({
        orcamentoId: id,
        cliente: orc.cliente,
        whatsapp: orc.whatsapp || null,
        endereco: endereco || null,
        produtos: produtos || null,
        vendedor: orc.vendedor || null,
        status: "pendente",
        observacoes: observacoes || null,
        dataEntrega: dataEntrega || null,
      }).returning();

      return entrega;
    });

    res.json({ mensagem: "Venda fechada! Entrega criada.", entregaId: result.id });
  } catch (error) {
    console.error("Erro ao fechar venda:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
