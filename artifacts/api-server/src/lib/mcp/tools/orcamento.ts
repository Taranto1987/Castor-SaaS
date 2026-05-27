import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createOrcamento } from "../../tools/write/orcamento";
import type { ToolContext } from "../../tools/context";

export function registerOrcamentoTools(server: McpServer, ctx: ToolContext): void {
  server.tool(
    "create_orcamento",
    "Gera e salva um orçamento para o cliente com os produtos selecionados. " +
    "Requer sessão autenticada (x-session-token). " +
    "Retorna id do orçamento, totais e link WhatsApp pronto para envio.",
    {
      cliente: z.string().describe("Nome do cliente."),
      whatsapp: z.string().optional().describe("Telefone do cliente (ex: 22999999999)."),
      produto_ids: z.array(z.number().int().positive()).min(1).describe(
        "IDs dos produtos a incluir no orçamento. Use search_products para obter os IDs."
      ),
      observacoes: z.string().optional().describe("Observações livres para o orçamento."),
      desconto_pix: z
        .number()
        .int()
        .min(0)
        .max(85)
        .optional()
        .describe("Desconto extra em pontos percentuais sobre o preço base (0–85). O desconto padrão de 15% já está incluído."),
    },
    async ({ cliente, whatsapp, produto_ids, observacoes, desconto_pix }) => {
      const result = await createOrcamento(
        { cliente, whatsapp, produto_ids, observacoes, desconto_pix },
        ctx,
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
