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

export async function runTools(
  toolUseBlocks: ToolUseBlock[],
  lojaId: number,
  ctx?: RunToolsCtx,
): Promise<ToolResultBlockParam[]> {
  const results = await Promise.all(
    toolUseBlocks.map(async (block): Promise<ToolResultBlockParam> => {
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
