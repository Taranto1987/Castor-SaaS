export type Tab = "visao" | "despesas" | "comissoes" | "dre";

export interface Alerta {
  tipo: string;
  titulo: string;
  descricao: string;
}

export interface Despesa {
  id: number;
  valor: string;
  categoria: string;
  descricao: string | null;
  comprovante: string | null;
  recorrente: boolean;
  confirmada: boolean;
  data: string;
}

export interface DespesaRecorrente {
  id: number;
  valor: string;
  categoria: string;
  descricao: string | null;
  diaVencimento: number;
}

export interface ComissaoVendedor {
  vendedor: string;
  vendas: number;
  totalVendido: number;
  percentual: number;
  comissao: number;
}

export interface DREData {
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

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function finGet(url: string, token: string) {
  return fetch(url, {
    headers: { "x-session-token": token },
  });
}

export function finPost(url: string, body: Record<string, unknown>, token: string) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify(body),
  });
}

export function finPut(url: string, body: Record<string, unknown>, token: string) {
  return fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify(body),
  });
}

export function finDelete(url: string, token: string) {
  return fetch(url, {
    method: "DELETE",
    headers: { "x-session-token": token },
  });
}
