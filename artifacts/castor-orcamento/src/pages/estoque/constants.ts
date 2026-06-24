export interface Produto {
  id: number;
  nome: string;
  categoria: string;
  medidas?: string | null;
  estoque: number | null;
  disponivel: boolean;
  encomenda: boolean;
}

export interface ProdutoGestao {
  id: number;
  nome: string;
  sku?: string | null;
  categoria: string;
  medidas?: string | null;
  size?: string | null;
  familyName?: string | null;
  encomenda: boolean;
  prazoEncomenda?: string | null;
  precoBase?: number | null;
  factoryCost?: number | null;
  outletMarkupPercent?: number | null;
  outletPrice?: number | null;
}

export interface PricingConfig {
  supplierDiscountPercent: number;
  outletMarkupPercent: number;
}

export function calcPreview(precoBase: number, supplierDiscount: number, markup: number) {
  const factoryCost = precoBase * (1 - supplierDiscount / 100);
  const outletPrice = factoryCost * (1 + markup / 100);
  return { factoryCost, outletPrice };
}

export const CAT_LABELS: Record<string, string> = {
  "colchoes": "Colchões",
  "cama-box": "Cama Box",
  "cama-box-colchao": "Box + Colchão",
  "travesseiros": "Travesseiros",
  "roupa-de-cama": "Roupa de Cama",
  "protetor": "Protetores",
};
