export type ProductSize = "Solteiro" | "Casal" | "Queen" | "King";

export const SIZE_ORDER: readonly ProductSize[] = ["Solteiro", "Casal", "Queen", "King"];

// Canonical alias map — all keys must be lowercased, accent-stripped, letters only.
// Includes wrong translations that appear from web scraping ("Rei" → "King", etc.)
const SIZE_MAP: Record<string, ProductSize> = {
  solteiro:  "Solteiro",
  solteirao: "Solteiro",   // solteirão stripped
  casal:     "Casal",
  queen:     "Queen",
  queensize: "Queen",
  king:      "King",
  kingsize:  "King",
  // Wrong translations produced by external scrapers
  rei:    "King",
  rainha: "Queen",
  // English aliases (defensive)
  single: "Solteiro",
  twin:   "Solteiro",
  full:   "Casal",
  double: "Casal",
};

/**
 * Maps any raw size string to a canonical ProductSize.
 * Returns null when the input is empty or unrecognised.
 */
export function normalizeSize(raw: string | null | undefined): ProductSize | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/[^a-z]/g, "");         // letters only
  return SIZE_MAP[key] ?? null;
}

// Dimensions the store actually stocks per canonical size.
// Products with different medidas are non-standard (go to outlet/encomenda).
export const STANDARD_MEDIDAS: Record<ProductSize, string> = {
  Solteiro: "88x188",
  Casal:    "138x188",
  Queen:    "158x198",
  King:     "193x203",
};

export function isStandardMedidas(size: ProductSize | null, medidas: string | null): boolean {
  if (!size || !medidas) return true;
  const standard = STANDARD_MEDIDAS[size];
  if (!standard) return true;
  const match = medidas.match(/(\d{2,3})\s*[xX×]\s*(\d{2,3})/);
  if (!match) return true;
  const [sw, sl] = standard.split("x").map(Number);
  return parseInt(match[1]) === sw && parseInt(match[2]) === sl;
}
