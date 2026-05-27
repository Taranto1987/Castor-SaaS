import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "../tools/context";
import { registerCatalogTools } from "./tools/catalog";
import { registerOrcamentoTools } from "./tools/orcamento";

export function createCastorMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({
    name: "castor-saas",
    version: "2.0.0",
  });

  registerCatalogTools(server, ctx);
  registerOrcamentoTools(server, ctx);

  return server;
}
