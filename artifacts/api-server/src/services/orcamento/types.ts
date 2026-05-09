export const BENEFICIO_CATEGORIA: Record<string, string> = {
  "colchoes":          "🌙 Engenharia do sono — conforto e saúde para sua noite",
  "cama-box":          "🏠 Base de qualidade — sustentação ideal para seu colchão",
  "cama-box-colchao":  "🌙 Conjunto completo — colchão + base em uma só compra",
  "travesseiros":      "💤 Suporte perfeito para pescoço e coluna",
  "roupa-de-cama":     "✨ Proteção e conforto para seu investimento",
  "protetor":          "🛡️ Proteção total — mantém a garantia do colchão",
};

export const BENEFICIO_DEFAULT = "✨ Qualidade Castor — fabricante líder em sono saudável";

export interface OrcamentoInput {
  cliente: string;
  whatsapp?: string;
  produtoIds: number[];
  observacoes?: string;
  descontoPix?: number;
  vendedor?: string;
  header?: string;
  wa?: string;
}

export interface ProdutoLinha {
  id: number;
  nome: string;
  sku?: string | null;
  preco?: string | null;
  precoPix?: string | null;
  precoBase: number;
  parcelamento?: string | null;
  medidas?: string | null;
  altura?: string | null;
  categoria: string;
  imagem?: string | null;
  link?: string | null;
  criadoEm?: Date | null;
}

export interface OrcamentoGerado {
  texto: string;
  totalPrecoBase: string;
  totalPix: string;
  totalPrazo: string;
  parcela12: string;
  descontoAplicado: string;
  descontoPercentual: number;
  produtos: ProdutoLinha[];
}
