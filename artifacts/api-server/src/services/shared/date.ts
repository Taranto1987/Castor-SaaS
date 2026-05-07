export function getMonthRange(mes: number, ano: number) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

export function parseMesAno(
  mesStr?: string,
  anoStr?: string
): { mes: number; ano: number } {
  const now = new Date();
  return {
    mes: mesStr ? parseInt(mesStr) : now.getMonth() + 1,
    ano: anoStr ? parseInt(anoStr) : now.getFullYear(),
  };
}

export const MESES_LABEL = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
