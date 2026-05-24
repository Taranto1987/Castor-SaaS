import type Anthropic from "@anthropic-ai/sdk";
import { searchProducts, getCatalog, getProductFamily, getStoreInfo } from "./tools/read";
import { logger } from "./logger";

type ToolUseBlock = Anthropic.Messages.ToolUseBlock;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

export async function runTools(
  toolUseBlocks: ToolUseBlock[],
  lojaId: number,
): Promise<ToolResultBlockParam[]> {
  const results = await Promise.all(
    toolUseBlocks.map(async (block): Promise<ToolResultBlockParam> => {
      const input = block.input as Record<string, unknown>;
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

        logger.info({ tool: block.name, lojaId }, "tool executed");

        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(data),
        };
      } catch (err) {
        logger.error({ err, tool: block.name }, "tool execution failed");
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
