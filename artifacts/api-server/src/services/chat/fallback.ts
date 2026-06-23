import type Anthropic from "@anthropic-ai/sdk";
import { getCatalog } from "../../lib/tools/read";
import { normalizeSize } from "@workspace/db";

type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

interface ProductLine {
  nome: string;
  precoPix: string | null;
  size: string | null;
}

function detectSizePreference(userMessages: string[]): string | null {
  const text = userMessages.join(" ").toLowerCase();
  const keywords: [RegExp, string][] = [
    [/\bking\b/, "King"],
    [/\bqueen\b/, "Queen"],
    [/\bcasal\b/, "Casal"],
    [/\bsolteiro\b|\bsolteir[aã]o\b|\bsingle\b|\btwin\b/, "Solteiro"],
  ];
  for (const [re, size] of keywords) {
    if (re.test(text)) return size;
  }
  return null;
}

/** Extracts product name/price/size from already-executed tool results. */
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
            precoPix: (rec["precoPix"] as string) ?? null,
            size: (rec["size"] as string) ?? null,
          });
        } else if (typeof rec["name"] === "string" && Array.isArray(rec["variants"])) {
          const v = rec["variants"][0] as Record<string, unknown> | undefined;
          out.push({
            nome: rec["name"],
            precoPix: (v?.["precoPix"] as string) ?? null,
            size: (v?.["size"] as string) ?? null,
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
    .filter(p => !sizePreference || !p.size || normalizeSize(p.size) === sizePreference)
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
          precoPix: variant?.precoPix ?? f.variants[0]?.precoPix ?? null,
          size: variant?.size ?? null,
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
    const sizeLabel = p.size ? ` (${p.size})` : "";
    return `• **${p.nome}**${sizeLabel}${p.precoPix ? ` — PIX: ${p.precoPix}` : ""}`;
  });
  return [
    "Com base no seu perfil, estas opções do nosso catálogo se destacam:",
    "",
    ...lines,
    "",
    "Quer que eu detalhe algum desses? Posso também refinar pela sua faixa de investimento.",
  ].join("\n");
}
