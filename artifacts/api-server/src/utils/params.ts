/** Normaliza um parâmetro de rota/query que pode chegar como string[] para string. */
export function str(val: string | string[]): string {
  return Array.isArray(val) ? (val[0] ?? "") : val;
}
