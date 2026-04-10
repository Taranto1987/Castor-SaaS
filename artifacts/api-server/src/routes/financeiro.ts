import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  despesasTable,
  despesasRecorrentesTable,
  comissoesConfigTable,
  metasTable,
  orcamentosTable,
  produtosTable,
} from "@workspace/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { getSession, isDono } from "../lib/sessions";

const router: IRouter = Router();

function parseBRL(valor?: string | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMonthRange(mes: number, ano: number) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) {
    res.status(401).json({ error: "Sessão não encontrada" });
    return;
  }
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return;
  }
  if (!isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao dono" });
    return;
  }
  next();
}

const CATEGORIAS_DESPESA = [
  "Aluguel",
  "Energia",
  "Água",
  "Internet/Telefone",
  "Salários",
  "Fornecedor",
  "Marketing",
  "Manutenção",
  "Transporte/Frete",
  "Material de limpeza",
  "Impostos",
  "Outros",
];

router.get("/categorias-despesa", requireDono, (_req, res) => {
  res.json(CATEGORIAS_DESPESA);
});

router.get("/despesas", requireDono, async (req, res) => {
  try {
    const { mes, ano, categoria } = req.query as {
      mes?: string;
      ano?: string;
      categoria?: string;
    };

    const now = new Date();
    const m = mes ? parseInt(mes) : now.getMonth() + 1;
    const a = ano ? parseInt(ano) : now.getFullYear();
    const { inicio, fim } = getMonthRange(m, a);

    const conditions = [
      gte(despesasTable.data, inicio),
      lte(despesasTable.data, fim),
    ];
    if (categoria) {
      conditions.push(eq(despesasTable.categoria, categoria));
    }

    const despesas = await db
      .select()
      .from(despesasTable)
      .where(and(...conditions))
      .orderBy(desc(despesasTable.data));

    res.json(despesas);
  } catch (error) {
    console.error("Erro ao listar despesas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/despesas", requireDono, async (req, res) => {
  try {
    const { valor, categoria, descricao, comprovante, recorrente, data } =
      req.body;

    if (!valor || !categoria) {
      res
        .status(400)
        .json({ error: "Valor e categoria são obrigatórios" });
      return;
    }

    const [inserted] = await db
      .insert(despesasTable)
      .values({
        valor: String(valor),
        categoria,
        descricao: descricao || null,
        comprovante: comprovante || null,
        recorrente: recorrente || false,
        data: data ? new Date(data) : new Date(),
      })
      .returning();

    res.json(inserted);
  } catch (error) {
    console.error("Erro ao criar despesa:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/despesas/:id", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { valor, categoria, descricao, comprovante, confirmada, data } =
      req.body;

    const updates: Partial<{
      valor: string;
      categoria: string;
      descricao: string | null;
      comprovante: string | null;
      confirmada: boolean;
      data: Date;
    }> = {};
    if (valor !== undefined) updates.valor = String(valor);
    if (categoria !== undefined) updates.categoria = categoria;
    if (descricao !== undefined) updates.descricao = descricao;
    if (comprovante !== undefined) updates.comprovante = comprovante;
    if (confirmada !== undefined) updates.confirmada = confirmada;
    if (data !== undefined) updates.data = new Date(data);

    const [updated] = await db
      .update(despesasTable)
      .set(updates)
      .where(eq(despesasTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Despesa não encontrada" }); return; }

    res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar despesa:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/despesas/:id", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.delete(despesasTable).where(eq(despesasTable.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao deletar despesa:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/despesas-recorrentes", requireDono, async (_req, res) => {
  try {
    const recorrentes = await db
      .select()
      .from(despesasRecorrentesTable)
      .where(eq(despesasRecorrentesTable.ativo, true))
      .orderBy(despesasRecorrentesTable.descricao);
    res.json(recorrentes);
  } catch (error) {
    console.error("Erro ao listar recorrentes:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/despesas-recorrentes", requireDono, async (req, res) => {
  try {
    const { valor, categoria, descricao, diaVencimento } = req.body;
    if (!valor || !categoria) {
      res
        .status(400)
        .json({ error: "Valor e categoria são obrigatórios" });
      return;
    }

    const [inserted] = await db
      .insert(despesasRecorrentesTable)
      .values({
        valor: String(valor),
        categoria,
        descricao: descricao || null,
        diaVencimento: diaVencimento || 1,
      })
      .returning();

    res.json(inserted);
  } catch (error) {
    console.error("Erro ao criar recorrente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/despesas-recorrentes/:id", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await db
      .update(despesasRecorrentesTable)
      .set({ ativo: false })
      .where(eq(despesasRecorrentesTable.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao remover recorrente:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/gerar-recorrentes", requireDono, async (req, res) => {
  try {
    const { mes, ano } = req.body;
    const now = new Date();
    const m = mes || now.getMonth() + 1;
    const a = ano || now.getFullYear();

    const recorrentes = await db
      .select()
      .from(despesasRecorrentesTable)
      .where(eq(despesasRecorrentesTable.ativo, true));

    const { inicio, fim } = getMonthRange(m, a);
    const existentes = await db
      .select()
      .from(despesasTable)
      .where(
        and(
          eq(despesasTable.recorrente, true),
          gte(despesasTable.data, inicio),
          lte(despesasTable.data, fim)
        )
      );

    const existentesIds = new Set(
      existentes.map((e) => e.recorrenteId)
    );

    const novas = [];
    for (const rec of recorrentes) {
      if (existentesIds.has(rec.id)) continue;
      const dia = Math.min(rec.diaVencimento, fim.getDate());
      novas.push({
        valor: rec.valor,
        categoria: rec.categoria,
        descricao: rec.descricao,
        recorrente: true,
        recorrenteId: rec.id,
        confirmada: false,
        data: new Date(a, m - 1, dia),
      });
    }

    if (novas.length > 0) {
      await db.insert(despesasTable).values(novas);
    }

    res.json({ geradas: novas.length });
  } catch (error) {
    console.error("Erro ao gerar recorrentes:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/comissoes", requireDono, async (req, res) => {
  try {
    const configs = await db
      .select()
      .from(comissoesConfigTable)
      .orderBy(comissoesConfigTable.vendedor);
    res.json(configs);
  } catch (error) {
    console.error("Erro ao listar comissões:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/comissoes", requireDono, async (req, res) => {
  try {
    const { vendedor, percentual } = req.body;
    if (!vendedor) {
      res.status(400).json({ error: "Vendedor é obrigatório" });
      return;
    }

    const existing = await db
      .select()
      .from(comissoesConfigTable)
      .where(eq(comissoesConfigTable.vendedor, vendedor));

    if (existing.length > 0) {
      const [updated] = await db
        .update(comissoesConfigTable)
        .set({ percentual: String(percentual || 2) })
        .where(eq(comissoesConfigTable.vendedor, vendedor))
        .returning();
      res.json(updated);
    } else {
      const [inserted] = await db
        .insert(comissoesConfigTable)
        .values({
          vendedor,
          percentual: String(percentual || 2),
        })
        .returning();
      res.json(inserted);
    }
  } catch (error) {
    console.error("Erro ao salvar comissão:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/comissoes/calculo", requireDono, async (req, res) => {
  try {
    const { mes, ano } = req.query as { mes?: string; ano?: string };
    const now = new Date();
    const m = mes ? parseInt(mes) : now.getMonth() + 1;
    const a = ano ? parseInt(ano) : now.getFullYear();
    const { inicio, fim } = getMonthRange(m, a);

    const vendas = await db
      .select()
      .from(orcamentosTable)
      .where(
        and(
          eq(orcamentosTable.status, "vendido"),
          gte(orcamentosTable.criadoEm, inicio),
          lte(orcamentosTable.criadoEm, fim)
        )
      );

    const configs = await db.select().from(comissoesConfigTable);
    const configMap: Record<string, number> = {};
    for (const c of configs) {
      configMap[c.vendedor] = parseFloat(c.percentual);
    }

    const porVendedor: Record<
      string,
      { vendedor: string; vendas: number; totalVendido: number; percentual: number; comissao: number }
    > = {};

    for (const v of vendas) {
      const vendedor = v.vendedor || "Sem vendedor";
      const valor = parseBRL(v.totalPix);
      if (!porVendedor[vendedor]) {
        const pct = configMap[vendedor] ?? 2;
        porVendedor[vendedor] = {
          vendedor,
          vendas: 0,
          totalVendido: 0,
          percentual: pct,
          comissao: 0,
        };
      }
      porVendedor[vendedor].vendas++;
      porVendedor[vendedor].totalVendido += valor;
    }

    for (const key in porVendedor) {
      const v = porVendedor[key];
      v.comissao = (v.totalVendido * v.percentual) / 100;
    }

    const resultado = Object.values(porVendedor).sort(
      (a, b) => b.totalVendido - a.totalVendido
    );
    const totalComissoes = resultado.reduce((s, v) => s + v.comissao, 0);

    res.json({ resultado, totalComissoes, mes: m, ano: a });
  } catch (error) {
    console.error("Erro ao calcular comissões:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/dre", requireDono, async (req, res) => {
  try {
    const { mes, ano } = req.query as { mes?: string; ano?: string };
    const now = new Date();
    const m = mes ? parseInt(mes) : now.getMonth() + 1;
    const a = ano ? parseInt(ano) : now.getFullYear();
    const { inicio, fim } = getMonthRange(m, a);

    const vendas = await db
      .select()
      .from(orcamentosTable)
      .where(
        and(
          eq(orcamentosTable.status, "vendido"),
          gte(orcamentosTable.criadoEm, inicio),
          lte(orcamentosTable.criadoEm, fim)
        )
      );

    let receitaBruta = 0;
    let custoProdutos = 0;

    for (const v of vendas) {
      receitaBruta += parseBRL(v.totalPix);
      const produtos = Array.isArray(v.produtosJson)
        ? (v.produtosJson as { custoBRL?: string; custo_brl?: string }[])
        : [];
      for (const p of produtos) {
        custoProdutos += parseBRL(p.custoBRL || p.custo_brl || null);
      }
    }

    const lucroBruto = receitaBruta - custoProdutos;

    const despesas = await db
      .select()
      .from(despesasTable)
      .where(
        and(
          gte(despesasTable.data, inicio),
          lte(despesasTable.data, fim),
          eq(despesasTable.confirmada, true)
        )
      );

    const despesasPorCategoria: Record<string, number> = {};
    let totalDespesas = 0;
    for (const d of despesas) {
      const val = parseFloat(d.valor);
      totalDespesas += val;
      despesasPorCategoria[d.categoria] =
        (despesasPorCategoria[d.categoria] || 0) + val;
    }

    const configs = await db.select().from(comissoesConfigTable);
    const configMap: Record<string, number> = {};
    for (const c of configs) {
      configMap[c.vendedor] = parseFloat(c.percentual);
    }

    let totalComissoes = 0;
    for (const v of vendas) {
      const vendedor = v.vendedor || "Sem vendedor";
      const pct = configMap[vendedor] ?? 2;
      totalComissoes += (parseBRL(v.totalPix) * pct) / 100;
    }

    const lucroLiquido = lucroBruto - totalDespesas - totalComissoes;

    res.json({
      mes: m,
      ano: a,
      receitaBruta,
      custoProdutos,
      lucroBruto,
      despesasPorCategoria,
      totalDespesas,
      totalComissoes,
      lucroLiquido,
      totalVendas: vendas.length,
    });
  } catch (error) {
    console.error("Erro no DRE:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/resumo-diario", requireDono, async (_req, res) => {
  try {
    const hoje = new Date();
    const inicioHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    );
    const fimHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate(),
      23,
      59,
      59,
      999
    );

    const vendasHoje = await db
      .select()
      .from(orcamentosTable)
      .where(
        and(
          eq(orcamentosTable.status, "vendido"),
          gte(orcamentosTable.criadoEm, inicioHoje),
          lte(orcamentosTable.criadoEm, fimHoje)
        )
      );

    const orcamentosHoje = await db
      .select()
      .from(orcamentosTable)
      .where(
        and(
          gte(orcamentosTable.criadoEm, inicioHoje),
          lte(orcamentosTable.criadoEm, fimHoje)
        )
      );

    let totalFaturado = 0;
    for (const v of vendasHoje) {
      totalFaturado += parseBRL(v.totalPix);
    }

    const despesasHoje = await db
      .select()
      .from(despesasTable)
      .where(
        and(
          gte(despesasTable.data, inicioHoje),
          lte(despesasTable.data, fimHoje)
        )
      );

    let totalDespesas = 0;
    for (const d of despesasHoje) {
      totalDespesas += parseFloat(d.valor);
    }

    const pendentes = await db
      .select()
      .from(orcamentosTable)
      .where(eq(orcamentosTable.status, "pendente"));

    const pendentesAntigos = pendentes.filter((p) => {
      if (!p.criadoEm) return false;
      const dias = Math.floor(
        (Date.now() - new Date(p.criadoEm).getTime()) / (1000 * 60 * 60 * 24)
      );
      return dias >= 3;
    });

    const lucroDia = totalFaturado - totalDespesas;

    const dataFormatada = hoje.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const linhas = [
      `📊 *RESUMO DO DIA*`,
      `📅 ${dataFormatada}`,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `🛒 *Vendas:* ${vendasHoje.length}`,
      `💰 *Faturado:* ${formatBRL(totalFaturado)}`,
      `📝 *Orçamentos do dia:* ${orcamentosHoje.length}`,
      ``,
      `💸 *Despesas do dia:* ${formatBRL(totalDespesas)}`,
      ``,
      `${lucroDia >= 0 ? "✅" : "🔴"} *Lucro do dia:* ${formatBRL(lucroDia)}`,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `⏳ *Orçamentos pendentes:* ${pendentes.length}`,
    ];

    if (pendentesAntigos.length > 0) {
      linhas.push(
        `⚠️ *${pendentesAntigos.length} orçamento(s) sem retorno há 3+ dias*`
      );
    }

    linhas.push(``, `━━━━━━━━━━━━━━━━━━`);
    linhas.push(`🏪 Castor Cabo Frio`);

    const texto = linhas.join("\n");

    res.json({
      vendas: vendasHoje.length,
      totalFaturado,
      orcamentosDia: orcamentosHoje.length,
      totalDespesas,
      lucroDia,
      pendentes: pendentes.length,
      pendentesAntigos: pendentesAntigos.length,
      texto,
    });
  } catch (error) {
    console.error("Erro no resumo diário:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/metas", async (req, res) => {
  try {
    const { mes, ano, operacao } = req.query as {
      mes?: string;
      ano?: string;
      operacao?: string;
    };
    const now = new Date();
    const m = mes ? parseInt(mes) : now.getMonth() + 1;
    const a = ano ? parseInt(ano) : now.getFullYear();
    const op = operacao || "cabo_frio";

    const [meta] = await db
      .select()
      .from(metasTable)
      .where(
        and(
          eq(metasTable.mes, m),
          eq(metasTable.ano, a),
          eq(metasTable.operacao, op)
        )
      );

    res.json(meta || null);
  } catch (error) {
    console.error("Erro ao buscar meta:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/metas", requireDono, async (req, res) => {
  try {
    const { mes, ano, valor, operacao } = req.body;
    const now = new Date();
    const m = mes || now.getMonth() + 1;
    const a = ano || now.getFullYear();
    const op = operacao || "cabo_frio";

    if (!valor || parseFloat(valor) <= 0) {
      res.status(400).json({ error: "Valor inválido" });
      return;
    }

    const existing = await db
      .select()
      .from(metasTable)
      .where(
        and(
          eq(metasTable.mes, m),
          eq(metasTable.ano, a),
          eq(metasTable.operacao, op)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(metasTable)
        .set({ valor: String(valor) })
        .where(eq(metasTable.id, existing[0].id))
        .returning();
      res.json(updated);
    } else {
      const [inserted] = await db
        .insert(metasTable)
        .values({
          mes: m,
          ano: a,
          valor: String(valor),
          operacao: op,
        })
        .returning();
      res.json(inserted);
    }
  } catch (error) {
    console.error("Erro ao salvar meta:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/alertas", requireDono, async (req, res) => {
  try {
    const { operacao: operacaoParam } = req.query as { operacao?: string };
    const operacao = operacaoParam || "cabo_frio";
    const now = new Date();
    const m = now.getMonth() + 1;
    const a = now.getFullYear();
    const { inicio, fim } = getMonthRange(m, a);
    const alertas: { tipo: string; titulo: string; descricao: string }[] = [];

    const [meta] = await db
      .select()
      .from(metasTable)
      .where(
        and(
          eq(metasTable.mes, m),
          eq(metasTable.ano, a),
          eq(metasTable.operacao, operacao)
        )
      );

    const vendas = await db
      .select()
      .from(orcamentosTable)
      .where(
        and(
          eq(orcamentosTable.status, "vendido"),
          gte(orcamentosTable.criadoEm, inicio),
          lte(orcamentosTable.criadoEm, fim)
        )
      );

    let totalVendido = 0;
    for (const v of vendas) {
      totalVendido += parseBRL(v.totalPix);
    }

    if (meta) {
      const metaVal = parseFloat(meta.valor);
      const diaAtual = now.getDate();
      const diasNoMes = fim.getDate();
      const pctTempo = diaAtual / diasNoMes;
      const pctMeta = totalVendido / metaVal;

      if (pctMeta < pctTempo * 0.8) {
        alertas.push({
          tipo: "meta",
          titulo: "Meta mensal em risco",
          descricao: `Vendido ${formatBRL(totalVendido)} de ${formatBRL(metaVal)} (${Math.round(pctMeta * 100)}%) com ${Math.round(pctTempo * 100)}% do mês.`,
        });
      }
    }

    const pendentes = await db
      .select()
      .from(orcamentosTable)
      .where(eq(orcamentosTable.status, "pendente"));

    const parados3dias = pendentes.filter((p) => {
      if (!p.criadoEm) return false;
      const dias = Math.floor(
        (Date.now() - new Date(p.criadoEm).getTime()) / (1000 * 60 * 60 * 24)
      );
      return dias >= 3;
    });

    if (parados3dias.length > 0) {
      alertas.push({
        tipo: "followup",
        titulo: `${parados3dias.length} orçamento(s) parado(s)`,
        descricao: `Orçamentos sem follow-up há mais de 3 dias.`,
      });
    }

    const despesasMes = await db
      .select()
      .from(despesasTable)
      .where(
        and(
          gte(despesasTable.data, inicio),
          lte(despesasTable.data, fim),
          eq(despesasTable.confirmada, true)
        )
      );

    let totalDesp = 0;
    for (const d of despesasMes) totalDesp += parseFloat(d.valor);

    const mesAnterior = getMonthRange(m === 1 ? 12 : m - 1, m === 1 ? a - 1 : a);
    const despMesAnterior = await db
      .select()
      .from(despesasTable)
      .where(
        and(
          gte(despesasTable.data, mesAnterior.inicio),
          lte(despesasTable.data, mesAnterior.fim),
          eq(despesasTable.confirmada, true)
        )
      );

    let totalDespAnterior = 0;
    for (const d of despMesAnterior) totalDespAnterior += parseFloat(d.valor);

    if (totalDespAnterior > 0 && totalDesp > totalDespAnterior * 1.2) {
      alertas.push({
        tipo: "despesas",
        titulo: "Despesas acima da média",
        descricao: `Despesas de ${formatBRL(totalDesp)} estão ${Math.round(((totalDesp / totalDespAnterior) - 1) * 100)}% acima do mês anterior.`,
      });
    }

    const produtos = await db.select().from(produtosTable).where(eq(produtosTable.disponivel, true));
    const lowMargin: string[] = [];
    for (const p of produtos) {
      const custo = parseBRL(p.custoBRL);
      const preco = parseBRL(p.precoPix || p.preco);
      if (custo > 0 && preco > 0) {
        const margem = ((preco - custo) / preco) * 100;
        if (margem < 30) {
          lowMargin.push(`${p.nome} (${Math.round(margem)}%)`);
        }
      }
    }
    if (lowMargin.length > 0) {
      alertas.push({
        tipo: "margem",
        titulo: `${lowMargin.length} produto(s) com margem baixa`,
        descricao: `Margem abaixo de 30%: ${lowMargin.slice(0, 5).join(", ")}${lowMargin.length > 5 ? ` e mais ${lowMargin.length - 5}` : ""}.`,
      });
    }

    res.json(alertas);
  } catch (error) {
    console.error("Erro nos alertas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/evolucao", requireDono, async (req, res) => {
  try {
    const { meses: mesesParam } = req.query as { meses?: string };
    const qtd = Math.min(parseInt(mesesParam || "6"), 12);
    const now = new Date();
    const resultado: {
      mes: number;
      ano: number;
      label: string;
      faturamento: number;
      despesas: number;
      lucro: number;
    }[] = [];

    for (let i = qtd - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const a = d.getFullYear();
      const { inicio, fim } = getMonthRange(m, a);

      const vendas = await db
        .select()
        .from(orcamentosTable)
        .where(
          and(
            eq(orcamentosTable.status, "vendido"),
            gte(orcamentosTable.criadoEm, inicio),
            lte(orcamentosTable.criadoEm, fim)
          )
        );

      let faturamento = 0;
      for (const v of vendas) faturamento += parseBRL(v.totalPix);

      const despesasMes = await db
        .select()
        .from(despesasTable)
        .where(
          and(
            gte(despesasTable.data, inicio),
            lte(despesasTable.data, fim),
            eq(despesasTable.confirmada, true)
          )
        );

      let totalDesp = 0;
      for (const dp of despesasMes) totalDesp += parseFloat(dp.valor);

      const MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      resultado.push({
        mes: m,
        ano: a,
        label: `${MESES_LABEL[m - 1]}/${String(a).slice(2)}`,
        faturamento,
        despesas: totalDesp,
        lucro: faturamento - totalDesp,
      });
    }

    res.json(resultado);
  } catch (error) {
    console.error("Erro na evolução:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/despesas/:id/comprovante", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        res.status(400).json({ error: "Arquivo vazio" });
        return;
      }
      if (buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: "Arquivo muito grande (max 5MB)" });
        return;
      }

      const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

      const [updated] = await db
        .update(despesasTable)
        .set({ comprovante: base64 })
        .where(eq(despesasTable.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Despesa não encontrada" });
        return;
      }

      res.json({ id: updated.id, comprovante: "uploaded" });
    });
  } catch (error) {
    console.error("Erro no upload:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
