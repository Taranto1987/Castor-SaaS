const CIDADES_CABO_FRIO = new Set([
  "cabo frio",
  "arraial do cabo",
  "armação dos búzios",
  "armacao dos buzios",
  "búzios",
  "buzios",
  "são pedro da aldeia",
  "sao pedro da aldeia",
  "iguaba grande",
  "casimiro de abreu",
  "rio das ostras",
]);

const CIDADES_ARARUAMA = new Set([
  "araruama",
  "saquarema",
  "marica",
  "maricá",
  "silva jardim",
  "são josé do vale do rio preto",
  "sao jose do vale do rio preto",
  "iguaí",
  "iguai",
]);

// CEP prefix (first 5 digits) → lojaId
const CEP_PREFIXES: Record<string, number> = {
  "28900": 1, // Cabo Frio
  "28910": 1,
  "28920": 1,
  "28930": 1, // Arraial do Cabo
  "28940": 1, // São Pedro da Aldeia / Búzios
  "28950": 1,
  "28860": 1, // Casimiro de Abreu
  "28190": 1, // Rio das Ostras
  "28970": 2, // Araruama
  "28980": 2,
  "28990": 2, // Saquarema
  "24900": 2, // Maricá
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function detectarLojaPorCidade(cidade: string): number {
  const norm = normalize(cidade);
  if (CIDADES_CABO_FRIO.has(norm)) return 1;
  if (CIDADES_ARARUAMA.has(norm)) return 2;
  // partial match fallback
  if (norm.includes("cabo frio") || norm.includes("buzios") || norm.includes("arraial")) return 1;
  if (norm.includes("araruama") || norm.includes("saquarema")) return 2;
  return 1; // default
}

export function detectarLojaPorCep(cep: string): number {
  const digits = cep.replace(/\D/g, "");
  const prefix = digits.slice(0, 5);
  return CEP_PREFIXES[prefix] ?? 1;
}

export function detectarLoja(params: {
  cidade?: string;
  cep?: string;
  ddd?: string;
  operacao?: string;
}): { lojaId: number; operacao: string; confianca: "alta" | "baixa" } {
  const { cidade, cep, operacao } = params;

  if (operacao === "araruama") return { lojaId: 2, operacao: "araruama", confianca: "alta" };
  if (operacao === "cabo_frio") return { lojaId: 1, operacao: "cabo_frio", confianca: "alta" };

  if (cep) {
    const lojaId = detectarLojaPorCep(cep);
    const op = lojaId === 2 ? "araruama" : "cabo_frio";
    return { lojaId, operacao: op, confianca: "alta" };
  }

  if (cidade) {
    const lojaId = detectarLojaPorCidade(cidade);
    const op = lojaId === 2 ? "araruama" : "cabo_frio";
    return { lojaId, operacao: op, confianca: "alta" };
  }

  return { lojaId: 1, operacao: "cabo_frio", confianca: "baixa" };
}
