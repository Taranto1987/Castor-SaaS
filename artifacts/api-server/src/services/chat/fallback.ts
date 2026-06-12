import type Anthropic from "@anthropic-ai/sdk";
import { getCatalog } from "../../lib/tools/read";

type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

interface ProductLine {
  nome: string;
  precoPix: string | null;
}

/** Extracts product name/price pairs from already-executed tool results. */
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
          // search_products shape
          out.push({ nome: rec["nome"], precoPix: (rec["precoPix"] as string) ?? null });
        } else if (typeof rec["name"] === "string" && Array.isArray(rec["variants"])) {
          // get_catalog / get_product_family shape
          const v = rec["variants"][0] as Record<string, unknown> | undefined;
          out.push({ nome: rec["name"], precoPix: (v?.["precoPix"] as string) ?? null });
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
): Promise<string> {
  let products = extractFromToolResults(toolResults)
    .filter(p => p.nome)
    .slice(0, 3);

  if (products.length === 0) {
    try {
      const families = await getCatalog({ category: "colchoes", lojaId });
      products = families.slice(0, 3).map(f => ({
        nome: f.name,
        precoPix: f.variants[0]?.precoPix ?? null,
      }));
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

  const lines = products.map(
    p => `• **${p.nome}**${p.precoPix ? ` — PIX: ${p.precoPix}` : ""}`,
  );
  return [
    "Com base no seu perfil, estas opções do nosso catálogo se destacam:",
    "",
    ...lines,
    "",
    "Quer que eu detalhe algum desses? Posso também refinar pela sua faixa de investimento.",
  ].join("\n");
}
