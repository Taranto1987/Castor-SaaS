export type ProductSize = "Solteiro" | "Solteiro King" | "Viúvo" | "Casal" | "Queen" | "King";

export const SIZE_ORDER: readonly ProductSize[] = ["Solteiro", "Solteiro King", "Viúvo", "Casal", "Queen", "King"];

const SIZE_MAP: Record<string, ProductSize> = {
  solteiro:      "Solteiro",
  solteiroking:  "Solteiro King",
  solteiraoking: "Solteiro King",
  solteirao:     "Viúvo",
  viuvo:         "Viúvo",
  viuva:         "Viúvo",
  casal:         "Casal",
  queen:         "Queen",
  queensize:     "Queen",
  king:          "King",
  kingsize:      "King",
  rei:    "King",
  rainha: "Queen",
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
