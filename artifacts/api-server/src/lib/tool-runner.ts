import type Anthropic from "@anthropic-ai/sdk";
import { searchProducts, getCatalog, getProductFamily, getStoreInfo } from "./tools/read";
import { createOrcamento } from "./tools/write/orcamento";
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

  // Semantic dedup: return synthetic result for duplicate calls to satisfy Anthropic's
  // requirement that every tool_use_id in the assistant message has a matching tool_result.
  const seen = new Set<string>();

  const results = await Promise.all(
    sliced.map(async (block): Promise<ToolResultBlockParam> => {
      const input = block.input as Record<string, unknown>;
      const firstParam = Object.values(input)[0] ?? "";
      const key = `${block.name}:${String(firstParam).toLowerCase().trim()}`;
      if (seen.has(key)) {
        logger.warn({ lojaId, tool: block.name }, "tool_dedup_skipped");
        return {
          type: "tool_result",
          tool_use_id: block.id,
          content: "Duplicate tool call — see previous result for same query.",
        };
      }
      seen.add(key);

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

          case "create_orcamento":
            data = await createOrcamento(
              {
                cliente: String(input["cliente"] ?? ""),
                whatsapp: input["whatsapp"] ? String(input["whatsapp"]) : undefined,
                produto_ids: Array.isArray(input["produto_ids"])
                  ? (input["produto_ids"] as unknown[]).map(Number).filter((n) => n > 0)
                  : [],
                observacoes: input["observacoes"] ? String(input["observacoes"]) : undefined,
                desconto_pix: input["desconto_pix"] !== null && input["desconto_pix"] !== undefined ? Number(input["desconto_pix"]) : undefined,
              },
              { lojaId, actorType: "agente" as const, requestId: ctx?.requestId },
            );
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
