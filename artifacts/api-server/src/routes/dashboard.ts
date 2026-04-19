import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { orcamentosTable, produtosTable, entregasTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function parseBRL(valor?: string | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

router.get("/", async (req, res) => {
  try {
    const { vendedor, papel } = req.query as { vendedor?: string; papel?: string };
    const filtraPorVendedor = vendedor && papel !== "dono";

    const orcCols = {
      status: orcamentosTable.status,
      vendedor: orcamentosTable.vendedor,
      totalPix: orcamentosTable.totalPix,
      totalPrazo: orcamentosTable.totalPrazo,
      produtosJson: orcamentosTable.produtosJson,
      criadoEm: orcamentosTable.criadoEm,
      precoBaseTotal: orcamentosTable.precoBaseTotal,
    };

    const orcamentosQuery = filtraPorVendedor
      ? db.select(orcCols).from(orcamentosTable).where(eq(orcamentosTable.vendedor, vendedor!)).orderBy(desc(orcamentosTable.criadoEm)).limit(500)
      : db.select(orcCols).from(orcamentosTable).orderBy(desc(orcamentosTable.criadoEm)).limit(500);

    const entregasCols = {
      status: entregasTable.status,
      vendedor: entregasTable.vendedor,
    };

    const entregasQuery = filtraPorVendedor
      ? db.select(entregasCols).from(entregasTable).where(eq(entregasTable.vendedor, vendedor!))
      : db.select(entregasCols).from(entregasTable);

    const [orcamentos, totalProdutos, entregas] = await Promise.all([
      orcamentosQuery,
      db.select({ count: sql<number>`count(*)` }).from(produtosTable),
      entregasQuery,
    ]);

    const totalOrcamentos = orcamentos.length;
    const vendidos = orcamentos.filter(o => o.status === "vendido");
    const totalVendas = vendidos.length;
    const taxaConversao = totalOrcamentos > 0
      ? Math.round((totalVendas / totalOrcamentos) * 100)
      : 0;

    let somaPixTotal = 0;
    let somaPrazoTotal = 0;
    let somaPixVendido = 0;

    const contagemVendedor: Record<string, { orcamentos: number; valorPix: number; vendas: number }> = {};
    const contagemProdutos: Record<string, number> = {};
    // Auditoria de desconto: soma descontoPct e contagem por vendedor (apenas vendidos com precoBaseTotal)
    const auditDesconto: Record<string, { totalPct: number; count: number }> = {};

    for (const orc of orcamentos) {
      const pix = parseBRL(orc.totalPix);
      const prazo = parseBRL(orc.totalPrazo);
      somaPixTotal += pix;
      somaPrazoTotal += prazo;

      if (orc.status === "vendido") somaPixVendido += pix;

      const vendedor = orc.vendedor || "Sem vendedor";
      if (!contagemVendedor[vendedor]) contagemVendedor[vendedor] = { orcamentos: 0, valorPix: 0, vendas: 0 };
      contagemVendedor[vendedor].orcamentos++;
      contagemVendedor[vendedor].valorPix += pix;
      if (orc.status === "vendido") contagemVendedor[vendedor].vendas++;

      // Calcula desconto médio somente em vendas fechadas com auditoria de preço
      if (orc.status === "vendido" && orc.precoBaseTotal && orc.totalPix) {
        const base = parseBRL(orc.precoBaseTotal as string);
        if (base > 0) {
          const descPct = ((base - pix) / base) * 100;
          if (!auditDesconto[vendedor]) auditDesconto[vendedor] = { totalPct: 0, count: 0 };
          auditDesconto[vendedor].totalPct += descPct;
          auditDesconto[vendedor].count++;
        }
      }

      const produtos = Array.isArray(orc.produtosJson) ? orc.produtosJson as any[] : [];
      for (const p of produtos) {
        const nome = p.nome || "Desconhecido";
        contagemProdutos[nome] = (contagemProdutos[nome] || 0) + 1;
      }
    }

    const descontoMedioPorVendedor = Object.entries(auditDesconto)
      .map(([vendedor, { totalPct, count }]) => ({
        vendedor,
        descontoMedio: Math.round((totalPct / count) * 10) / 10,
        vendasAuditadas: count,
      }))
      .sort((a, b) => b.descontoMedio - a.descontoMedio);

    const topProdutos = Object.entries(contagemProdutos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nome, count]) => ({ nome, count }));

    const porVendedor = Object.entries(contagemVendedor)
      .sort((a, b) => b[1].orcamentos - a[1].orcamentos)
      .map(([vendedor, dados]) => ({ vendedor, ...dados }));

    const ultimos7Dias: Record<string, number> = {};
    const hoje = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      ultimos7Dias[key] = 0;
    }
    for (const orc of orcamentos) {
      if (!orc.criadoEm) continue;
      const d = new Date(orc.criadoEm);
      const diffDays = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 6) {
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (key in ultimos7Dias) ultimos7Dias[key]++;
      }
    }
    const orcamentosPorDia = Object.entries(ultimos7Dias).map(([dia, count]) => ({ dia, count }));

    const totalEntregas = entregas.length;
    const entregasPorStatus = {
      pendente: entregas.filter(e => e.status === "pendente").length,
      em_rota: entregas.filter(e => e.status === "em_rota").length,
      entregue: entregas.filter(e => e.status === "entregue").length,
      cancelado: entregas.filter(e => e.status === "cancelado").length,
    };

    res.json({
      totalOrcamentos,
      totalVendas,
      taxaConversao,
      somaPixTotal: somaPixTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      somaPrazoTotal: somaPrazoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      somaPixVendido: somaPixVendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      totalProdutosCatalogo: Number(totalProdutos[0]?.count ?? 0),
      topProdutos,
      porVendedor,
      orcamentosPorDia,
      totalEntregas,
      entregasPorStatus,
      descontoMedioPorVendedor,
    });
  } catch (error) {
    console.error("Erro no dashboard:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
