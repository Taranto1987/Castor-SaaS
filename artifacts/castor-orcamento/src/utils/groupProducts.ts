export type Size = "King" | "Queen" | "Casal" | "Solteiro";

export const SIZE_ORDER: readonly Size[] = ["King", "Queen", "Casal", "Solteiro"];

// ─── Slug-based extraction (PRIMARY — deterministic) ─────────────────────────
// Slug structure: {prefix}-{size}-{model-slug}-{dimensions}cm
// e.g. colchao-castor-solteiro-red-white-double-face-d33-88x188x27cm
//   → family slug: colchao-castor-red-white-double-face-d33
//   → size: Solteiro

const SIZE_SLUG_ENTRIES: { slug: string; size: Size }[] = [
  { slug: "king-size",  size: "King" },
  { slug: "queen-size", size: "Queen" },
  { slug: "king",       size: "King" },
  { slug: "queen",      size: "Queen" },
  { slug: "casal",      size: "Casal" },
  { slug: "solteiro",   size: "Solteiro" },
];

function extractFromSlug(slug: string): { familySlug: string; size: Size | null } {
  // 1. Strip trailing dimension segments: -88x188x27cm, -88x188cm, -88x188
  const clean = slug
    .replace(/-\d[\dx]*cm$/i, "")  // e.g. -88x188x27cm
    .replace(/-\d[\dx]*$/i, "");   // e.g. -88x188 (no unit)

  // 2. Find and remove the size segment (longest match first)
  for (const { slug: sizeSlug, size } of SIZE_SLUG_ENTRIES) {
    const re = new RegExp(`(^|-)${sizeSlug}(-|$)`, "i");
    const match = clean.match(re);
    if (!match) continue;

    const familySlug = clean
      .replace(re, (_full, before: string, after: string) =>
        before && after ? "-" : ""   // keep one dash when in the middle
      )
      .replace(/^-|-$/g, "");        // clean boundary dashes

    return { familySlug, size };
  }

  return { familySlug: clean, size: null };
}

// ─── Name-based extraction (FALLBACK — for products without slugs) ────────────
// Size word must be at the end, optionally followed by dimensions starting with
// a digit. Words like "Impermeável" after the size word prevent a match.

const NAME_SIZE_PATTERNS: { re: RegExp; size: Size }[] = [
  { re: /\s+King\s+Size(\s+\d[\dxX×.,cm\s]*)?$/i, size: "King" },
  { re: /\s+Queen\s+Size(\s+\d[\dxX×.,cm\s]*)?$/i, size: "Queen" },
  { re: /\s+King(\s+\d[\dxX×.,cm\s]*)?$/i,         size: "King" },
  { re: /\s+Queen(\s+\d[\dxX×.,cm\s]*)?$/i,        size: "Queen" },
  { re: /\s+Casal(\s+\d[\dxX×.,cm\s]*)?$/i,        size: "Casal" },
  { re: /\s+Solteirão(\s+\d[\dxX×.,cm\s]*)?$/i,    size: "Solteiro" },
  { re: /\s+Solteiro(\s+\d[\dxX×.,cm\s]*)?$/i,     size: "Solteiro" },
];

function extractFamilyFromName(nome: string): { familia: string; size: Size | null } {
  for (const { re, size } of NAME_SIZE_PATTERNS) {
    if (re.test(nome)) {
      return { familia: nome.replace(re, "").trim(), size };
    }
  }
  return { familia: nome, size: null };
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Main grouping function ───────────────────────────────────────────────────

export function groupProducts(products: CatalogoProduto[]): ProductGroup[] {
  const groupMap = new Map<
    string,
    { familia: string; categoria: string; variants: Variant[] }
  >();

  const ungrouped: ProductGroup[] = [];

  for (const p of products) {
    let placed = false;

    // ── PRIMARY: slug-based (reliable, deterministic) ──
    if (p.slug) {
      const { familySlug, size } = extractFromSlug(p.slug);
      if (size !== null) {
        const key = `${p.categoria}::${familySlug}`;
        if (!groupMap.has(key)) {
          // Display name: strip size+dims from the product name
          const { familia } = extractFamilyFromName(p.nome);
          groupMap.set(key, { familia, categoria: p.categoria, variants: [] });
        }
        const entry = groupMap.get(key)!;
        if (!entry.variants.some(v => v.size === size)) {
          entry.variants.push({ ...p, size });
        }
        placed = true;
      }
    }

    // ── FALLBACK: name-based (for products without slugs) ──
    if (!placed) {
      const { familia, size } = extractFamilyFromName(p.nome);
      if (size !== null) {
        const key = `${p.categoria}::name::${familia.toLowerCase()}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { familia, categoria: p.categoria, variants: [] });
        }
        const entry = groupMap.get(key)!;
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
