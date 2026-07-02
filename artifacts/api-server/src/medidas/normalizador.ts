/**
 * NORMALIZADOR DE MEDIDAS — Camada 2
 *
 * Tudo que entra no sistema (título do crawler, mensagem do cliente no
 * WhatsApp, filtro do catálogo, query de busca) passa AQUI antes de
 * consultar a Tabela Mestre.
 *
 * Formatos aceitos (todos viram "88x188"):
 *   "88x188"        "88X188"        "88 x 188"
 *   "0,88x1,88"     "0.88x1.88"     (metros → cm)
 *   "88x188x30"     (altura descartada — colchão tem 3 dimensões no site)
 *   "188x88"        (invertido → menor sempre primeiro = largura)
 *   "88cm x 188cm"  "88 × 188"      (símbolo × unicode)
 *   "medida 88/188"
 *
 * REJEITADOS (retorna null, nunca chute):
 *   dígitos colados sem separador ("088188") — parsing ambíguo, risco de
 *   classificar errado silenciosamente. Erro explícito > erro invisível.
 */

export interface MedidaNormalizada {
  medida: string; // canônica "LxC", ex: "88x188"
  largura: number;
  comprimento: number;
}

const SEPARADOR = /[x×/*]/i;

export function normalizarMedida(entrada: unknown): MedidaNormalizada | null {
  if (typeof entrada !== "string") return null;

  const texto = entrada
    .toLowerCase()
    .replace(/cm|mm|metros|m\b/g, " ")
    .trim();

  // Extrai todas as dimensões, exigindo um separador ("x", "×", "/", "*")
  // entre os números. Aceita vírgula e ponto decimal.
  const partes = texto
    .split(SEPARADOR)
    .map((p) => p.replace(/[^\d.,]/g, "").replace(",", "."))
    .filter((p) => p.length > 0);

  if (partes.length < 2) return null;

  // Usa as duas primeiras dimensões; a terceira (altura) é descartada.
  const valores = partes.slice(0, 2).map(Number);
  if (valores.some((v) => !Number.isFinite(v) || v <= 0)) return null;

  // Metros → centímetros (qualquer dimensão < 10 é metro: 0,88 / 2,03)
  const emCm = valores.map((v) => (v < 10 ? Math.round(v * 100) : Math.round(v)));

  // Sanidade: colchão real fica entre 60 e 250 cm por dimensão
  if (emCm.some((v) => v < 60 || v > 250)) return null;

  // Menor dimensão = largura, maior = comprimento (corrige entrada invertida)
  const [largura, comprimento] = [...emCm].sort((a, b) => a - b);

  return { medida: `${largura}x${comprimento}`, largura, comprimento };
}
