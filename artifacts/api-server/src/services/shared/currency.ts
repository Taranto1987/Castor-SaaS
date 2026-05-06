export function parseBRL(valor?: string | null): number {
  if (!valor) return 0;
  const clean = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
