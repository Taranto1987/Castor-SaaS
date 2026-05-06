import { parseBRL, formatBRL } from "../shared/currency";
import { getMonthRange, MESES_LABEL, parseMesAno } from "../shared/date";
import {
  findVendasPeriodo,
  findDespesasConfirmadas,
  findComissoesConfig,
  findOrcamentosPeriodo,
  findOrcamentosPendentes,
  findProdutosDisponiveis,
  findMeta,
} from "./repository";
import type { DREResult, EvolucaoMes, ResumoDiario, Alerta } from "./types";

export async function calcularDRE(mes: number, ano: number): Promise<DREResult> {
  const { inicio, fim } = getMonthRange(mes, ano);

  const vendas = await findVendasPeriodo(inicio, fim);
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

  const despesas = await findDespesasConfirmadas(inicio, fim);
  const despesasPorCategoria: Record<string, number> = {};
  let totalDespesas = 0;
  for (const d of despesas) {
    const val = parseFloat(d.valor);
    totalDespesas += val;
    despesasPorCategoria[d.categoria] = (despesasPorCategoria[d.categoria] || 0) + val;
  }

  const configs = await findComissoesConfig();
  const configMap: Record<string, number> = {};
  for (const c of configs) configMap[c.vendedor] = parseFloat(c.percentual);

  let totalComissoes = 0;
  for (const v of vendas) {
    const pct = configMap[v.vendedor || ""] ?? 2;
    totalComissoes += (parseBRL(v.totalPix) * pct) / 100;
  }

  return {
    mes, ano, receitaBruta, custoProdutos, lucroBruto,
    despesasPorCategoria, totalDespesas, totalComissoes,
    lucroLiquido: lucroBruto - totalDespesas - totalComissoes,
    totalVendas: vendas.length,
  };
}

export async function calcularComissoes(mes: number, ano: number) {
  const { inicio, fim } = getMonthRange(mes, ano);
  const vendas = await findVendasPeriodo(inicio, fim);
  const configs = await findComissoesConfig();
  const configMap: Record<string, number> = {};
  for (const c of configs) configMap[c.vendedor] = parseFloat(c.percentual);

  const totaisPorVendedor: Record<string, number> = {};
  for (const v of vendas) {
    const vendedor = v.vendedor || "Sem vendedor";
    totaisPorVendedor[vendedor] = (totaisPorVendedor[vendedor] || 0) + parseBRL(v.totalPix);
  }

  let totalComissoes = 0;
  const resultado = Object.entries(totaisPorVendedor).map(([vendedor, total]) => {
    const percentual = configMap[vendedor] ?? 2;
    const comissao = (total * percentual) / 100;
    totalComissoes += comissao;
    return { vendedor, total, comissao, percentual };
  });

  return { resultado, totalComissoes, mes, ano };
}

export async function calcularResumoDiario(): Promise<ResumoDiario> {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);

  const vendasHoje = await findVendasPeriodo(inicioHoje, fimHoje);
  const orcamentosHoje = await findOrcamentosPeriodo(inicioHoje, fimHoje);
  const pendentes = await findOrcamentosPendentes();
  const despesasHoje = await findDespesasConfirmadas(inicioHoje, fimHoje);

  let totalFaturado = 0;
  for (const v of vendasHoje) totalFaturado += parseBRL(v.totalPix);

  let totalDespesas = 0;
  for (const d of despesasHoje) totalDespesas += parseFloat(d.valor);

  const pendentesAntigos = pendentes.filter((p) => {
    if (!p.criadoEm) return false;
    const dias = Math.floor((Date.now() - new Date(p.criadoEm).getTime()) / 86_400_000);
    return dias >= 3;
  });

  const lucroDia = totalFaturado - totalDespesas;
  const dataFormatada = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

  const texto = [
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
    ...(pendentesAntigos.length > 0 ? [`⚠️ *${pendentesAntigos.length} orçamento(s) sem retorno há 3+ dias*`] : []),
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🏪 Castor Cabo Frio`,
  ].join("\n");

  return {
    vendas: vendasHoje.length,
    totalFaturado,
    orcamentosDia: orcamentosHoje.length,
    totalDespesas,
    lucroDia,
    pendentes: pendentes.length,
    pendentesAntigos: pendentesAntigos.length,
    texto,
  };
}

export async function calcularEvolucao(qtdMeses: number): Promise<EvolucaoMes[]> {
  const now = new Date();
  const resultado: EvolucaoMes[] = [];

  for (let i = qtdMeses - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { mes: m, ano: a } = parseMesAno(String(d.getMonth() + 1), String(d.getFullYear()));
    const { inicio, fim } = getMonthRange(m, a);

    const vendas = await findVendasPeriodo(inicio, fim);
    let faturamento = 0;
    for (const v of vendas) faturamento += parseBRL(v.totalPix);

    const despesasMes = await findDespesasConfirmadas(inicio, fim);
    let totalDesp = 0;
    for (const dp of despesasMes) totalDesp += parseFloat(dp.valor);

    resultado.push({
      mes: m, ano: a,
      label: `${MESES_LABEL[m - 1]}/${String(a).slice(2)}`,
      faturamento, despesas: totalDesp, lucro: faturamento - totalDesp,
    });
  }

  return resultado;
}

export async function calcularAlertas(operacao: string): Promise<Alerta[]> {
  const now = new Date();
  const { mes: m, ano: a } = parseMesAno();
  const { inicio, fim } = getMonthRange(m, a);
  const alertas: Alerta[] = [];

  const meta = await findMeta(m, a, operacao);
  const vendas = await findVendasPeriodo(inicio, fim);
  let totalVendido = 0;
  for (const v of vendas) totalVendido += parseBRL(v.totalPix);

  if (meta) {
    const metaVal = parseFloat(meta.valor);
    const pctTempo = now.getDate() / fim.getDate();
    const pctMeta = totalVendido / metaVal;
    if (pctMeta < pctTempo * 0.8) {
      alertas.push({
        tipo: "meta",
        titulo: "Meta mensal em risco",
        descricao: `Vendido ${formatBRL(totalVendido)} de ${formatBRL(metaVal)} (${Math.round(pctMeta * 100)}%) com ${Math.round(pctTempo * 100)}% do mês.`,
      });
    }
  }

  const pendentes = await findOrcamentosPendentes();
  const parados3dias = pendentes.filter((p) => {
    if (!p.criadoEm) return false;
    return Math.floor((Date.now() - new Date(p.criadoEm).getTime()) / 86_400_000) >= 3;
  });
  if (parados3dias.length > 0) {
    alertas.push({ tipo: "followup", titulo: `${parados3dias.length} orçamento(s) parado(s)`, descricao: `Orçamentos sem follow-up há mais de 3 dias.` });
  }

  const despesasMes = await findDespesasConfirmadas(inicio, fim);
  let totalDesp = 0;
  for (const d of despesasMes) totalDesp += parseFloat(d.valor);

  const { inicio: prevInicio, fim: prevFim } = getMonthRange(m === 1 ? 12 : m - 1, m === 1 ? a - 1 : a);
  const despMesAnt = await findDespesasConfirmadas(prevInicio, prevFim);
  let totalDespAnt = 0;
  for (const d of despMesAnt) totalDespAnt += parseFloat(d.valor);

  if (totalDespAnt > 0 && totalDesp > totalDespAnt * 1.2) {
    alertas.push({
      tipo: "despesas",
      titulo: "Despesas acima da média",
      descricao: `Despesas de ${formatBRL(totalDesp)} estão ${Math.round(((totalDesp / totalDespAnt) - 1) * 100)}% acima do mês anterior.`,
    });
  }

  const produtos = await findProdutosDisponiveis();
  const lowMargin: string[] = [];
  for (const p of produtos) {
    const custo = parseBRL(p.custoBRL);
    const preco = parseBRL(p.precoPix || p.preco);
    if (custo > 0 && preco > 0 && ((preco - custo) / preco) * 100 < 30) {
      lowMargin.push(`${p.nome} (${Math.round(((preco - custo) / preco) * 100)}%)`);
    }
  }
  if (lowMargin.length > 0) {
    alertas.push({
      tipo: "margem",
      titulo: `${lowMargin.length} produto(s) com margem baixa`,
      descricao: `Margem abaixo de 30%: ${lowMargin.slice(0, 5).join(", ")}${lowMargin.length > 5 ? ` e mais ${lowMargin.length - 5}` : ""}.`,
    });
  }

  return alertas;
}
