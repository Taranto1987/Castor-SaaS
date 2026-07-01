import type { ProductSize } from "./normalizeSize";

export interface FamilyInfo {
  familySlug: string;
  familyName: string;
  size: ProductSize | null;
}

// Order matters: longer/more specific entries must come first.
const SIZE_SLUG_ENTRIES: { slug: string; size: ProductSize }[] = [
  { slug: "solteiro-king-size", size: "Solteiro King" },
  { slug: "solteiro-king",      size: "Solteiro King" },
  { slug: "solteirao",          size: "Viúvo"          },
  { slug: "viuvo",              size: "Viúvo"          },
  { slug: "viuva",              size: "Viúvo"          },
  { slug: "king-size",          size: "King"           },
  { slug: "queen-size",         size: "Queen"          },
  { slug: "king",               size: "King"           },
  { slug: "queen",              size: "Queen"          },
  { slug: "casal",              size: "Casal"          },
  { slug: "solteiro",           size: "Solteiro"       },
];

const NAME_SIZE_PATTERNS: { re: RegExp; size: ProductSize }[] = [
  { re: /\s+Solteiro\s+King(\s+Size)?(\s+\d[\dxX×.,cm\s]*)?$/i, size: "Solteiro King" },
  { re: /\s+Solteirão(\s+\d[\dxX×.,cm\s]*)?$/i,                 size: "Viúvo"          },
  { re: /\s+Vi[úu]v[oa](\s+\d[\dxX×.,cm\s]*)?$/i,              size: "Viúvo"          },
  { re: /\s+King\s+Size(\s+\d[\dxX×.,cm\s]*)?$/i,               size: "King"           },
  { re: /\s+Queen\s+Size(\s+\d[\dxX×.,cm\s]*)?$/i,              size: "Queen"          },
  { re: /\s+King(\s+\d[\dxX×.,cm\s]*)?$/i,                      size: "King"           },
  { re: /\s+Queen(\s+\d[\dxX×.,cm\s]*)?$/i,                     size: "Queen"          },
  { re: /\s+Casal(\s+\d[\dxX×.,cm\s]*)?$/i,                     size: "Casal"          },
  { re: /\s+Solteiro(\s+\d[\dxX×.,cm\s]*)?$/i,                  size: "Solteiro"       },
];

function familyNameFromNome(nome: string): string {
  for (const { re } of NAME_SIZE_PATTERNS) {
    if (re.test(nome)) return nome.replace(re, "").trim();
  }
  // Strip trailing dimension string like "180x200x27cm" or "88X188"
  return nome.replace(/\s+\d{2,3}[xX×]\d{2,3}(\s*[xX×]\s*\d{1,3})?\s*(cm)?\s*$/gi, "").trim();
}

/**
 * Derives the family group fields from a product's slug (primary) or name
 * (fallback). Called at write-time in the crawler and backfill script so the
 * frontend never has to parse strings.
 */
export function extractFamilyInfo(slug: string | null | undefined, nome: string): FamilyInfo {
  // ── PRIMARY: slug-based ────────────────────────────────────────────────────
  if (slug) {
    // Normalize accent-broken prefix used by some Castor URLs ("ã" → "o" with hyphen)
    const normalizedSlug = slug.replace(/^colch-o-castor/, "colchao-castor");

    // Strip trailing dimension segment: -88x188x27cm or -88x188
    const clean = normalizedSlug
      .replace(/-\d[\dx]*cm$/i, "")
      .replace(/-\d[\dx]*$/i,   "");

    for (const { slug: sizeSlug, size } of SIZE_SLUG_ENTRIES) {
      const re = new RegExp(`(^|-)${sizeSlug}(-|$)`, "i");
      if (!clean.match(re)) continue;

      const familySlug = clean
        .replace(re, (_full, before: string, after: string) =>
          before && after ? "-" : ""
        )
        .replace(/^-|-$/g, "");

      return { familySlug, familyName: familyNameFromNome(nome), size };
    }
  }

  // ── FALLBACK: name-based ───────────────────────────────────────────────────
  for (const { re, size } of NAME_SIZE_PATTERNS) {
    if (re.test(nome)) {
      const familyName = nome.replace(re, "").trim();
      const familySlug = familyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return { familySlug, familyName, size };
    }
  }

  // ── NO SIZE — standalone product ───────────────────────────────────────────
  const familySlug = (slug ?? nome)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { familySlug, familyName: nome, size: null };
}
