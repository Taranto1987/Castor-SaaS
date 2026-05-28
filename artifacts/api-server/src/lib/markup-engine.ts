// Markup percentages by Castor product category.
// "regular" = standard sell price; "outlet" = outlet / factory-direct price.
// Numbers are % over factory cost (e.g. 70 means 1.70× cost).
const MARKUP_TABLE: Record<string, { regular: number; outlet: number }> = {
  "colchoes":          { regular: 70, outlet: 35 },
  "cama-box":          { regular: 60, outlet: 30 },
  "cama-box-colchao":  { regular: 65, outlet: 32 },
  "travesseiros":      { regular: 120, outlet: 60 },
  "protetor":          { regular: 100, outlet: 50 },
  "roupa-de-cama":     { regular: 80,  outlet: 40 },
};

const DEFAULT_MARKUP = { regular: 70, outlet: 35 };

// Fallback: infer category from product name keywords when no DB match exists.
function inferCategoryFromName(nome: string): string | null {
  const n = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (n.includes("colchao") || n.includes("colchoes")) return "colchoes";
  if (n.includes("cama") || n.includes("box")) return "cama-box";
  if (n.includes("travesseiro")) return "travesseiros";
  if (n.includes("protetor") || n.includes("capa")) return "protetor";
  if (n.includes("fronha") || n.includes("roupa") || n.includes("lencol")) return "roupa-de-cama";
  return null;
}

export interface MarkupSuggestion {
  categoria: string | null;
  markupPercent: number;
  outletMarkupPercent: number;
  precoSugerido: number;
  outletPrice: number;
}

export function suggestMarkup(
  custoUnitario: number,
  categoria: string | null,
  nomeExtraido?: string,
): MarkupSuggestion | null {
  if (custoUnitario <= 0) return null;

  const cat = categoria ?? (nomeExtraido ? inferCategoryFromName(nomeExtraido) : null);
  const table = (cat ? MARKUP_TABLE[cat] : null) ?? DEFAULT_MARKUP;

  return {
    categoria: cat,
    markupPercent: table.regular,
    outletMarkupPercent: table.outlet,
    precoSugerido: parseFloat((custoUnitario * (1 + table.regular / 100)).toFixed(2)),
    outletPrice: parseFloat((custoUnitario * (1 + table.outlet / 100)).toFixed(2)),
  };
}
