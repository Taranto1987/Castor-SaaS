export type Size = "King" | "Queen" | "Casal" | "Solteiro";

export const SIZE_ORDER: readonly Size[] = ["King", "Queen", "Casal", "Solteiro"];

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
  familySlug?: string | null;
  familyName?: string | null;
  size?: string | null;
};

export type Variant = CatalogoProduto & { size: Size };

export type ProductGroup = {
  key: string;
  familia: string;
  categoria: string;
  variants: Variant[];
  hasSizes: boolean;
};

export function groupProducts(products: CatalogoProduto[]): ProductGroup[] {
  const groupMap = new Map<string, { familia: string; categoria: string; variants: Variant[] }>();
  const ungrouped: ProductGroup[] = [];

  for (const p of products) {
    const validSize = SIZE_ORDER.includes(p.size as Size) ? (p.size as Size) : null;

    if (p.familySlug && validSize) {
      // Products with family data from the database — the correct path.
      const key = `${p.categoria}::${p.familySlug}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          familia: p.familyName ?? p.nome,
          categoria: p.categoria,
          variants: [],
        });
      }
      const entry = groupMap.get(key)!;
      if (!entry.variants.some(v => v.size === validSize)) {
        entry.variants.push({ ...p, size: validSize });
      }
    } else {
      // Standalone product (no size, or family data not yet backfilled).
      ungrouped.push({
        key: `single::${p.id}`,
        familia: p.familyName ?? p.nome,
        categoria: p.categoria,
        variants: [{ ...p, size: (validSize ?? "King") as Size }],
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
