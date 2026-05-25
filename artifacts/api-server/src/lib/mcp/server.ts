import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchProducts, getCatalog, getProductFamily, getStoreInfo } from "../tools/read";
import { logToolExecution } from "../log-tool-execution";

interface McpCtx {
  lojaId: number;
  requestId?: string;
}

export function createCastorMcpServer(ctx: McpCtx): McpServer {
  const { lojaId, requestId } = ctx;
  const server = new McpServer({
    name: "castor-saas",
    version: "1.0.0",
  });

  server.tool(
    "search_products",
    "Busca produtos do catálogo Castor por texto livre e/ou categoria.",
    {
      query: z.string().describe("Texto de busca — modelo, tecnologia, tamanho, etc."),
      category: z.string().optional().describe(
        "Filtro de categoria: colchoes | cama-box | cama-box-colchao | travesseiros | protetor | roupa-de-cama"
      ),
    },
    async ({ query, category }) => {
      const start = Date.now();
      try {
        const data = await searchProducts({ query, category, lojaId });
        logToolExecution({ lojaId, toolName: "search_products", source: "mcp", status: "success", durationMs: Date.now() - start, inputSummary: { query, category }, requestId });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        logToolExecution({ lojaId, toolName: "search_products", source: "mcp", status: "error", durationMs: Date.now() - start, errorMessage: String(err).slice(0, 500), requestId });
        throw err;
      }
    },
  );

  server.tool(
    "get_catalog",
    "Retorna o catálogo completo da loja agrupado por família com preços atualizados.",
    {
      category: z.string().optional().describe(
        "Filtro de categoria: colchoes | cama-box | cama-box-colchao | travesseiros | protetor | roupa-de-cama"
      ),
    },
    async ({ category }) => {
      const start = Date.now();
      try {
        const data = await getCatalog({ category, lojaId });
        logToolExecution({ lojaId, toolName: "get_catalog", source: "mcp", status: "success", durationMs: Date.now() - start, inputSummary: { category }, requestId });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        logToolExecution({ lojaId, toolName: "get_catalog", source: "mcp", status: "error", durationMs: Date.now() - start, errorMessage: String(err).slice(0, 500), requestId });
        throw err;
      }
    },
  );

  server.tool(
    "get_product_family",
    "Retorna detalhes de uma família: todos os tamanhos, preços e disponibilidade.",
    {
      family_id: z.string().describe("Slug da família (ex: colchao-castor-toque-de-luxo)."),
    },
    async ({ family_id }) => {
      const start = Date.now();
      try {
        const data = await getProductFamily({ familyId: family_id, lojaId });
        logToolExecution({ lojaId, toolName: "get_product_family", source: "mcp", status: "success", durationMs: Date.now() - start, inputSummary: { family_id }, requestId });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        logToolExecution({ lojaId, toolName: "get_product_family", source: "mcp", status: "error", durationMs: Date.now() - start, errorMessage: String(err).slice(0, 500), requestId });
        throw err;
      }
    },
  );

  server.tool(
    "get_store_info",
    "Retorna WhatsApp, endereço e responsável da loja.",
    {},
    async () => {
      const start = Date.now();
      try {
        const data = await getStoreInfo({ lojaId });
        logToolExecution({ lojaId, toolName: "get_store_info", source: "mcp", status: "success", durationMs: Date.now() - start, requestId });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        logToolExecution({ lojaId, toolName: "get_store_info", source: "mcp", status: "error", durationMs: Date.now() - start, errorMessage: String(err).slice(0, 500), requestId });
        throw err;
      }
    },
  );

  return server;
}
