import type Anthropic from "@anthropic-ai/sdk";
import { searchProducts, getCatalog, getProductFamily, getStoreInfo } from "./tools/read";
import { logger } from "./logger";
import { logToolExecution } from "./log-tool-execution";

type ToolUseBlock = Anthropic.Messages.ToolUseBlock;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

interface RunToolsCtx {
  correlationId?: string;
  requestId?: string;
}

const MAX_TOOLS_PER_TURN = 2;

export async function runTools(
  toolUseBlocks: ToolUseBlock[],
  lojaId: number,
  ctx?: RunToolsCtx,
): Promise<ToolResultBlockParam[]> {
  // Hard budget: max 2 tools per turn
  const sliced = toolUseBlocks.slice(0, MAX_TOOLS_PER_TURN);
  if (sliced.length < toolUseBlocks.length) {
    logger.warn({ lojaId, requested: toolUseBlocks.length, executed: sliced.length }, "tool_budget_exceeded");
  }

  // Semantic dedup: skip calls with identical name + primary input param
  const seen = new Set<string>();
  const dedupedBlocks = sliced.filter(block => {
    const firstParam = Object.values(block.input ?? {})[0] ?? "";
    const key = `${block.name}:${String(firstParam).toLowerCase().trim()}`;
    if (seen.has(key)) {
      logger.warn({ lojaId, tool: block.name }, "tool_dedup_skipped");
      return false;
    }
    seen.add(key);
    return true;
  });

  const results = await Promise.all(
    dedupedBlocks.map(async (block): Promise<ToolResultBlockParam> => {
      const input = block.input as Record<string, unknown>;
      const start = Date.now();
      try {
        let data: unknown;

        switch (block.name) {
          case "search_products":
            data = await searchProducts({
              query: String(input["query"] ?? ""),
              category: input["category"] ? String(input["category"]) : undefined,
              lojaId,
            });
            break;

          case "get_catalog":
            data = await getCatalog({
              category: input["category"] ? String(input["category"]) : undefined,
              lojaId,
            });
            break;

          case "get_product_family":
            data = await getProductFamily({
              familyId: String(input["family_id"] ?? ""),
              lojaId,
            });
            break;

          case "get_store_info":
            data = await getStoreInfo({ lojaId });
            break;

          default:
            data = { error: `Tool desconhecida: ${block.name}` };
        }

        const durationMs = Date.now() - start;
        logger.info({ tool: block.name, lojaId, durationMs }, "tool executed");
        logToolExecution({
          lojaId,
          toolName: block.name,
          source: "chat",
          status: "success",
          durationMs,
          inputSummary: input,
          ...ctx,
        });

        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(data),
        };
      } catch (err) {
        const durationMs = Date.now() - start;
        const isTimeout = err instanceof Error && err.name === "AbortError";
        logger.error({ err, tool: block.name, durationMs }, "tool execution failed");
        logToolExecution({
          lojaId,
          toolName: block.name,
          source: "chat",
          status: isTimeout ? "timeout" : "error",
          durationMs,
          inputSummary: input,
          errorMessage: String(err).slice(0, 500),
          ...ctx,
        });
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify({ error: "Erro ao buscar dados. Tente de outra forma." }),
          is_error: true,
        };
      }
    }),
  );

  return results;
}
