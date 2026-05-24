import type Anthropic from "@anthropic-ai/sdk";

// Shared tool definitions used by both ThallesZzz (Anthropic tool_use)
// and the MCP server. lojaId is always injected server-side — never in schema.

export const CASTOR_READ_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_products",
    description:
      "Busca produtos do catálogo Castor por texto livre e/ou categoria. " +
      "Use quando o cliente perguntar sobre um modelo específico, tecnologia ou tamanho.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Texto de busca — nome do modelo, tecnologia (pocket, espuma, gel), tamanho, etc.",
        },
        category: {
          type: "string",
          description:
            "Filtro de categoria (opcional): colchoes | cama-box | cama-box-colchao | travesseiros | protetor | roupa-de-cama",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_catalog",
    description:
      "Retorna o catálogo completo da loja agrupado por família de produto com preços atualizados. " +
      "Use para mostrar todas as opções disponíveis ou filtrar por categoria.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            "Filtro de categoria (opcional): colchoes | cama-box | cama-box-colchao | travesseiros | protetor | roupa-de-cama",
        },
      },
      required: [],
    },
  },
  {
    name: "get_product_family",
    description:
      "Retorna detalhes completos de uma família de produto: todos os tamanhos disponíveis, " +
      "preços, disponibilidade e dimensões. Use quando o cliente quiser saber mais sobre um modelo específico.",
    input_schema: {
      type: "object" as const,
      properties: {
        family_id: {
          type: "string",
          description: "Slug da família (ex: colchao-castor-toque-de-luxo). Use o familySlug retornado por search_products.",
        },
      },
      required: ["family_id"],
    },
  },
  {
    name: "get_store_info",
    description:
      "Retorna informações da loja: número de WhatsApp, responsável, endereço e cidade. " +
      "Use quando o cliente perguntar sobre contato, localização ou horário.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

export const CASTOR_WRITE_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "create_orcamento",
    description:
      "Gera e salva um orçamento para o cliente com os produtos selecionados. " +
      "Use quando o cliente confirmar interesse em produtos específicos e quiser receber uma proposta. " +
      "Retorna id do orçamento, totais e link WhatsApp pronto para envio.",
    input_schema: {
      type: "object" as const,
      properties: {
        cliente: { type: "string", description: "Nome do cliente." },
        whatsapp: { type: "string", description: "Telefone do cliente (ex: 22999999999)." },
        produto_ids: {
          type: "array",
          items: { type: "number" },
          description: "IDs dos produtos a incluir. Use search_products para obter os IDs.",
        },
        observacoes: { type: "string", description: "Observações livres para o orçamento." },
        desconto_pix: {
          type: "number",
          description: "Desconto extra em pontos percentuais (0–85). O desconto padrão de 15% já está incluído.",
        },
      },
      required: ["cliente", "produto_ids"],
    },
  },
];

export const CASTOR_ALL_TOOLS: Anthropic.Messages.Tool[] = [
  ...CASTOR_READ_TOOLS,
  ...CASTOR_WRITE_TOOLS,
];
