export type ProductSize = "Solteiro" | "Casal" | "Queen" | "King";

export const SIZE_ORDER: readonly ProductSize[] = ["Solteiro", "Casal", "Queen", "King"];

const SIZE_MAP: Record<string, ProductSize> = {
  solteiro:  "Solteiro",
  solteirao: "Solteiro",
  casal:     "Casal",
  queen:     "Queen",
  queensize: "Queen",
  king:      "King",
  kingsize:  "King",
  // Wrong translations from web scraping
  rei:    "King",
  rainha: "Queen",
  // English aliases
  single: "Solteiro",
  twin:   "Solteiro",
  full:   "Casal",
  double: "Casal",
};

export function normalizeSize(raw: string | null | undefined): ProductSize | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  return SIZE_MAP[key] ?? null;
}
