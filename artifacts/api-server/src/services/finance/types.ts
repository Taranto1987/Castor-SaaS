export interface DREResult {
  mes: number;
  ano: number;
  receitaBruta: number;
  custoProdutos: number;
  lucroBruto: number;
  despesasPorCategoria: Record<string, number>;
  totalDespesas: number;
  totalComissoes: number;
  lucroLiquido: number;
  totalVendas: number;
}

export interface EvolucaoMes {
  mes: number;
  ano: number;
  label: string;
  faturamento: number;
  despesas: number;
  lucro: number;
}

export interface ResumoDiario {
  vendas: number;
  totalFaturado: number;
  orcamentosDia: number;
  totalDespesas: number;
  lucroDia: number;
  pendentes: number;
  pendentesAntigos: number;
  texto: string;
}

export interface Alerta {
  tipo: "meta" | "followup" | "despesas" | "margem";
  titulo: string;
  descricao: string;
}

export interface ComissaoResult {
  resultado: { vendedor: string; total: number; comissao: number; percentual: number }[];
  totalComissoes: number;
  mes: number;
  ano: number;
}

export const CATEGORIAS_DESPESA = [
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
] as const;
