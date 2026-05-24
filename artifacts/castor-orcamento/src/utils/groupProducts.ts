import { normalizeSize, SIZE_ORDER } from "./normalizeSize";
import type { ProductSize } from "./normalizeSize";

// Re-export for components that import from this module
export type { ProductSize as Size } from "./normalizeSize";
export { SIZE_ORDER };

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

export type Variant = CatalogoProduto & { size: ProductSize };

export type ProductGroup = {
  key: string;
  familia: string;
  categoria: string;
  variants: Variant[];
  hasSizes: boolean;
};

/**
 * Groups a flat crawler product list into family cards with normalised sizes.
 * Used by Outlet.tsx (reads raw crawler data).
 *
 * Catalogo.tsx uses /api/catalog/families which returns pre-grouped
 * Castor Core data and does NOT call this function.
 */
export function groupProducts(products: CatalogoProduto[]): ProductGroup[] {
  const groupMap = new Map<string, { familia: string; categoria: string; variants: Variant[] }>();
  const ungrouped: ProductGroup[] = [];

  for (const p of products) {
    const validSize = normalizeSize(p.size);

    if (p.familySlug && validSize) {
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
      ungrouped.push({
        key: `single::${p.id}`,
        familia: p.familyName ?? p.nome,
        categoria: p.categoria,
        variants: [{ ...p, size: (validSize ?? "Casal") as ProductSize }],
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
