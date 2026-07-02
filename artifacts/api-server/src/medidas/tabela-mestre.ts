/**
 * TABELA MESTRE DE MEDIDAS — Single Source of Truth
 *
 * REGRA DE OURO: nenhum módulo do sistema (Crawler, Catálogo, Filtro, Busca,
 * Mapa do Sono, Talib, SEO) toma decisão com base no NOME do produto.
 * O único identificador confiável é a MEDIDA. Tudo deriva dela.
 *
 * Esta tabela é código, não banco: medidas de linha Castor mudam com
 * frequência de anos, não de dias. Alteração aqui = PR revisado, nunca
 * mutação por crawler. O crawler CONSOME esta tabela; jamais a escreve.
 *
 * Localização: BACKEND ONLY (artifacts/api-server). O frontend recebe apenas
 * { categoria, nomeExibido, slug, status } via API — nunca a tabela nem a lógica.
 */

export const CATEGORIAS = [
  "SOLTEIRO",
  "SOLTEIRAO",
  "CASAL",
  "QUEEN",
  "KING",
  "KING_EUROPEU",
  "ESPECIAL",
  "NAO_MAPEADA", // fallback obrigatório — nunca chutar categoria
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type StatusMedida = "padrao" | "sob_encomenda";

export interface EntradaTabelaMestre {
  /** chave canônica no formato "LARGURAxCOMPRIMENTO" em cm, ex: "88x188" */
  medida: string;
  largura: number; // cm
  comprimento: number; // cm
  categoria: Categoria;
  nomeExibido: string;
  status: StatusMedida;
  /** slug canônico para URL de categoria (SEO) */
  slug: string;
}

/**
 * Fonte única. Chave = medida canônica.
 * NUNCA adicionar entrada por nome de produto. Só por medida.
 */
export const TABELA_MESTRE: Record<string, EntradaTabelaMestre> = {
  "88x188": {
    medida: "88x188",
    largura: 88,
    comprimento: 188,
    categoria: "SOLTEIRO",
    nomeExibido: "Solteiro",
    status: "padrao",
    slug: "solteiro",
  },
  "96x203": {
    medida: "96x203",
    largura: 96,
    comprimento: 203,
    categoria: "SOLTEIRAO",
    nomeExibido: "Solteirão (Solteiro King)",
    status: "padrao",
    slug: "solteirao",
  },
  "100x200": {
    medida: "100x200",
    largura: 100,
    comprimento: 200,
    categoria: "ESPECIAL",
    nomeExibido: "Solteiro Especial",
    status: "sob_encomenda",
    slug: "sob-encomenda",
  },
  "120x203": {
    medida: "120x203",
    largura: 120,
    comprimento: 203,
    categoria: "ESPECIAL",
    nomeExibido: "Solteiro Especial",
    status: "sob_encomenda",
    slug: "sob-encomenda",
  },
  "138x188": {
    medida: "138x188",
    largura: 138,
    comprimento: 188,
    categoria: "CASAL",
    nomeExibido: "Casal",
    status: "padrao",
    slug: "casal",
  },
  "158x198": {
    medida: "158x198",
    largura: 158,
    comprimento: 198,
    categoria: "QUEEN",
    nomeExibido: "Queen Size",
    status: "padrao",
    slug: "queen",
  },
  "180x200": {
    medida: "180x200",
    largura: 180,
    comprimento: 200,
    categoria: "KING_EUROPEU",
    nomeExibido: "King Europeu",
    status: "sob_encomenda",
    slug: "sob-encomenda",
  },
  "193x203": {
    medida: "193x203",
    largura: 193,
    comprimento: 203,
    categoria: "KING",
    nomeExibido: "King Size",
    status: "padrao",
    slug: "king",
  },
};

/**
 * Sinônimos de NOME → categoria, usados EXCLUSIVAMENTE pela Busca
 * (quando o cliente digita "solteirão" em vez de uma medida).
 * Nunca usado pelo Crawler nem pelo Mapa do Sono — esses só usam medida.
 */
export const SINONIMOS_BUSCA: Record<string, Categoria> = {
  solteiro: "SOLTEIRO",
  solteirao: "SOLTEIRAO",
  "solteiro king": "SOLTEIRAO",
  casal: "CASAL",
  queen: "QUEEN",
  "queen size": "QUEEN",
  king: "KING",
  "king size": "KING",
  "king europeu": "KING_EUROPEU",
  "sob encomenda": "ESPECIAL",
  especial: "ESPECIAL",
};
