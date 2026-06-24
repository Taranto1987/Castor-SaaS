export const INCOMODO_PARA_MOTIVO: Record<string, string> = {
  dor: "dor_coluna",
  afundando: "afundou",
};

export const TAMANHOS_VALIDOS = ["solteiro", "casal", "queen", "king"] as const;
export const CONJUNTOS_VALIDOS = ["colchao", "box_colchao", "box_bau_colchao"] as const;

export function whatsappBRValido(digits: string): boolean {
  return /^(55)?[1-9][0-9]9?[0-9]{8}$/.test(digits);
}

export const ESTAGIOS = ["novo", "contato", "proposta", "negociacao", "ganho", "perdido"] as const;

export const ALLOWED_PATCH_FIELDS = [
  "nome", "whatsapp", "email", "estagio", "origem", "tags",
  "observacoes", "vendedorAtribuido", "perfilBiomecanico",
  "motivoPerda", "motivoGanho",
  "statusFunil", "motivoTroca", "prazoCompra",
  "produtoFinalVendido", "motivoNaoVenda", "satisfacaoPosVenda",
] as const;

export const FIELD_LABELS: Partial<Record<typeof ALLOWED_PATCH_FIELDS[number], string>> = {
  nome: "Nome", whatsapp: "WhatsApp", email: "E-mail",
  origem: "Origem", tags: "Tags", observacoes: "Observações",
  vendedorAtribuido: "Vendedor", perfilBiomecanico: "Perfil biomecanico",
  motivoPerda: "Motivo perda", motivoGanho: "Motivo ganho",
  statusFunil: "Status funil", motivoTroca: "Motivo troca",
  prazoCompra: "Prazo compra", produtoFinalVendido: "Produto vendido",
  motivoNaoVenda: "Motivo não-venda", satisfacaoPosVenda: "Satisfação pós-venda",
};
