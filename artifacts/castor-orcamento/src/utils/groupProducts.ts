export type Size = "King" | "Queen" | "Casal" | "Solteiro";

export const SIZE_ORDER: readonly Size[] = ["King", "Queen", "Casal", "Solteiro"];

// Ordered longest-first so "King Size" matches before "King".
// (\s+.*)? allows trailing dimensions like "88x188" or "88x188x30cm" after the size word.
const SIZE_PATTERNS: { re: RegExp; size: Size }[] = [
  { re: /\s+King\s+Size(\s+.*)?$/i, size: "King" },
  { re: /\s+Queen\s+Size(\s+.*)?$/i, size: "Queen" },
  { re: /\s+King(\s+.*)?$/i, size: "King" },
  { re: /\s+Queen(\s+.*)?$/i, size: "Queen" },
  { re: /\s+Casal(\s+.*)?$/i, size: "Casal" },
  { re: /\s+Solteirão(\s+.*)?$/i, size: "Solteiro" },
  { re: /\s+Solteiro(\s+.*)?$/i, size: "Solteiro" },
];

export type CatalogoProduto = {
  id: number;
  nome: string;
  sku?: string | null;
  slug?: string | null;
  preco?: string | null;
  precoPix?: string | null;
  parcelamento?: string | null;
  medidas?: string | null;
  altura?: string | null;
  categoria: string;
  imagem?: string | null;
  disponivel?: boolean | null;
  encomenda?: boolean | null;
  estoque?: number | null;
};

export type Variant = CatalogoProduto & { size: Size };

export type ProductGroup = {
  key: string;
  familia: string;
  categoria: string;
  variants: Variant[];
  hasSizes: boolean;
};

function extractFamilyAndSize(nome: string): { familia: string; size: Size | null } {
  for (const { re, size } of SIZE_PATTERNS) {
    if (re.test(nome)) {
      return { familia: nome.replace(re, "").trim(), size };
    }
  }
  return { familia: nome, size: null };
}

export function groupProducts(products: CatalogoProduto[]): ProductGroup[] {
  const groupMap = new Map<string, { familia: string; categoria: string; variants: Variant[] }>();
  const ungrouped: ProductGroup[] = [];

  for (const p of products) {
    const { familia, size } = extractFamilyAndSize(p.nome);
    if (size !== null) {
      const key = `${p.categoria}::${familia.toLowerCase()}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, { familia, categoria: p.categoria, variants: [] });
      }
      const entry = groupMap.get(key)!;
      // Keep first occurrence per size to avoid duplicates
      if (!entry.variants.some(v => v.size === size)) {
        entry.variants.push({ ...p, size });
      }
    } else {
      ungrouped.push({
        key: `single::${p.id}`,
        familia: p.nome,
        categoria: p.categoria,
        variants: [{ ...p, size: "King" as Size }],
        hasSizes: false,
      });
    }
  }

  const grouped: ProductGroup[] = [];
  for (const [key, { familia, categoria, variants }] of groupMap) {
    const sorted = [...variants].sort(
      (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)
    );
    grouped.push({ key, familia, categoria, variants: sorted, hasSizes: true });
  }

  return [...grouped, ...ungrouped];
}
