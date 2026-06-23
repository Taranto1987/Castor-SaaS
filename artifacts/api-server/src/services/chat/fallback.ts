import type Anthropic from "@anthropic-ai/sdk";
import { getCatalog } from "../../lib/tools/read";
import { normalizeSize } from "@workspace/db";

type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

interface ProductLine {
  nome: string;
  familyName: string | null;
  precoPix: string | null;
  size: string | null;
  slug: string | null;
}

function cleanDisplayName(p: ProductLine): string {
  const raw = p.familyName ?? p.nome;
  return raw.replace(/^Colch[aã]o\s+Castor\s*/i, "").trim() || p.nome;
}

const SIZE_KEYWORDS: [RegExp, string][] = [
  [/\bking\b/i, "King"],
  [/\bqueen\b/i, "Queen"],
  [/\bcasal\b/i, "Casal"],
  [/\bsolteiro\b|\bsolteir[aã]o\b|\bsingle\b|\btwin\b/i, "Solteiro"],
];

function detectSizeFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [re, size] of SIZE_KEYWORDS) {
    if (re.test(lower)) return size;
  }
  return null;
}

function detectSizePreference(userMessages: string[]): string | null {
  return detectSizeFromText(userMessages.join(" "));
}

function matchesSize(product: ProductLine, sizePreference: string): boolean {
  if (product.size) return normalizeSize(product.size) === sizePreference;
  const nameSize = detectSizeFromText(product.nome);
  if (nameSize) return nameSize === sizePreference;
  return false;
}

/** Extracts product name/price/size/slug from already-executed tool results. */
function extractFromToolResults(toolResults: ToolResultBlockParam[]): ProductLine[] {
  const out: ProductLine[] = [];
  for (const tr of toolResults) {
    if (typeof tr.content !== "string") continue;
    try {
      const data: unknown = JSON.parse(tr.content);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        if (typeof rec["nome"] === "string") {
          out.push({
            nome: rec["nome"],
            familyName: (rec["familyName"] as string) ?? null,
            precoPix: (rec["precoPix"] as string) ?? null,
            size: (rec["size"] as string) ?? null,
            slug: (rec["slug"] as string) ?? null,
          });
        } else if (typeof rec["name"] === "string" && Array.isArray(rec["variants"])) {
          const v = rec["variants"][0] as Record<string, unknown> | undefined;
          out.push({
            nome: rec["name"],
            familyName: (rec["name"] as string) ?? null,
            precoPix: (v?.["precoPix"] as string) ?? null,
            size: (v?.["size"] as string) ?? null,
            slug: null,
          });
        }
      }
    } catch {
      // non-JSON tool result — skip
    }
  }
  return out;
}

/**
 * Deterministic recommendation when the LLM pass fails or returns nothing.
 * Contingency rule: no lead ends the conversation without a recommendation.
 * Uses tool results already fetched this turn; falls back to a direct catalog
 * query; only as last resort hands off to WhatsApp.
 */
export async function buildRecommendationFallback(
  toolResults: ToolResultBlockParam[],
  lojaId: number,
  userMessages?: string[],
): Promise<string> {
  const sizePreference = userMessages?.length ? detectSizePreference(userMessages) : null;

  let products = extractFromToolResults(toolResults)
    .filter(p => p.nome)
    .filter(p => !sizePreference || matchesSize(p, sizePreference))
    .slice(0, 3);

  if (products.length === 0) {
    try {
      const families = await getCatalog({ category: "colchoes", lojaId });
      const filtered = sizePreference
        ? families.filter(f => f.variants.some(v => normalizeSize(v.size) === sizePreference))
        : families;
      products = filtered.slice(0, 3).map(f => {
        const variant = sizePreference
          ? f.variants.find(v => normalizeSize(v.size) === sizePreference)
          : f.variants[0];
        return {
          nome: f.name,
          familyName: f.name,
          precoPix: variant?.precoPix ?? f.variants[0]?.precoPix ?? null,
          size: variant?.size ?? null,
          slug: null,
        };
      });
    } catch {
      // DB unavailable — fall through to WhatsApp handoff
    }
  }

  if (products.length === 0) {
    return (
      "Tive uma instabilidade ao montar sua recomendação agora, mas seu perfil ficou registrado. " +
      "Me chama no WhatsApp que um especialista finaliza na hora: Cabo Frio (22) 99241-0112 ou Araruama (22) 98844-7240."
    );
  }

  const lines = products.map(p => {
    const displayName = cleanDisplayName(p);
    const label = p.slug ? `[${displayName}](/produto/${p.slug})` : `**${displayName}**`;
    const sizeLabel = p.size ? ` (${p.size})` : "";
    return `• ${label}${sizeLabel}${p.precoPix ? ` — PIX: ${p.precoPix}` : ""}`;
  });
  return [
    "Com base no seu perfil, estas opções do nosso catálogo se destacam:",
    "",
    ...lines,
    "",
    "Quer que eu detalhe algum desses? Posso também refinar pela sua faixa de investimento.",
  ].join("\n");
}
