import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchProducts, getCatalog, getProductFamily, getStoreInfo } from "../../tools/read";
import type { ToolContext } from "../../tools/context";

const CATEGORY_DESC =
  "Filtro de categoria: colchoes | cama-box | cama-box-colchao | travesseiros | protetor | roupa-de-cama";

export function registerCatalogTools(server: McpServer, ctx: ToolContext): void {
  server.tool(
    "search_products",
    "Busca produtos do catálogo Castor por texto livre e/ou categoria. Use quando o cliente perguntar sobre um modelo específico, tecnologia ou tamanho.",
    {
      query: z.string().describe("Texto de busca — nome do modelo, tecnologia (pocket, espuma, gel), tamanho, etc."),
      category: z.string().optional().describe(CATEGORY_DESC),
    },
    async ({ query, category }) => {
      const data = await searchProducts({ query, category, lojaId: ctx.lojaId });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "get_catalog",
    "Retorna o catálogo completo da loja agrupado por família com preços atualizados.",
    { category: z.string().optional().describe(CATEGORY_DESC) },
    async ({ category }) => {
      const data = await getCatalog({ category, lojaId: ctx.lojaId });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "get_product_family",
    "Retorna detalhes de uma família: todos os tamanhos, preços e disponibilidade.",
    { family_id: z.string().describe("Slug da família (ex: colchao-castor-toque-de-luxo).") },
    async ({ family_id }) => {
      const data = await getProductFamily({ familyId: family_id, lojaId: ctx.lojaId });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "get_store_info",
    "Retorna WhatsApp, endereço e responsável da loja.",
    {},
    async () => {
      const data = await getStoreInfo({ lojaId: ctx.lojaId });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
