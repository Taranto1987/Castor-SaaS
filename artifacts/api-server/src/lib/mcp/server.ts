import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchProducts, getCatalog, getProductFamily, getStoreInfo } from "../tools/read";

export function createCastorMcpServer(lojaId: number): McpServer {
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
      const data = await searchProducts({ query, category, lojaId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
      const data = await getCatalog({ category, lojaId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "get_product_family",
    "Retorna detalhes de uma família: todos os tamanhos, preços e disponibilidade.",
    {
      family_id: z.string().describe("Slug da família (ex: colchao-castor-toque-de-luxo)."),
    },
    async ({ family_id }) => {
      const data = await getProductFamily({ familyId: family_id, lojaId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "get_store_info",
    "Retorna WhatsApp, endereço e responsável da loja.",
    {},
    async () => {
      const data = await getStoreInfo({ lojaId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  return server;
}
