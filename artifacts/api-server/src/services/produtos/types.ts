import type { produtosTable } from "@workspace/db/schema";

export type ProdutoRow = typeof produtosTable.$inferSelect;

export interface MappedProduto {
  id: number;
  nome: string;
  sku: string | null;
  slug: string | null;
  preco: string | null;
  precoPix: string | null;
  parcelamento: string | null;
  medidas: string | null;
  altura: string | null;
  categoria: string;
  imagem: string | null;
  disponivel: boolean;
  encomenda: boolean;
  custoBRL: string | null;
  prazoEncomenda: string | null;
  estoque: number | null;
  precoBase: number | null;
  factoryCost: number | null;
  outletMarkupPercent: number | null;
  outletPrice: number | null;
  familySlug: string | null;
  familyName: string | null;
  size: string | null;
  descricao: string | null;
  fichaTecnica: Record<string, unknown> | null;
  imagens: Array<{ url: string; label: string | null }>;
  criadoEm: Date | null;
}

export type MappedProdutoPublic = Omit<MappedProduto, "custoBRL" | "precoBase" | "factoryCost" | "outletMarkupPercent">;
