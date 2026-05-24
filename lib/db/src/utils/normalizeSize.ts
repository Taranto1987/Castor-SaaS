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
