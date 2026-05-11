export type MessageType =
  | "saudacao"
  | "preco"
  | "logistica"
  | "intencao_compra"
  | "geral";

export function classificarMensagem(msg: string): MessageType {
  const m = msg.toLowerCase();

  if (m.includes("oi") || m.includes("olá") || m.includes("ola") || m.includes("bom dia") || m.includes("boa tarde") || m.includes("boa noite")) {
    return "saudacao";
  }
  if (m.includes("preço") || m.includes("preco") || m.includes("valor") || m.includes("quanto custa") || m.includes("custa")) {
    return "preco";
  }
  if (m.includes("entrega") || m.includes("frete") || m.includes("prazo") || m.includes("endereço")) {
    return "logistica";
  }
  if (m.includes("quero") || m.includes("comprar") || m.includes("interessado") || m.includes("fechar")) {
    return "intencao_compra";
  }

  return "geral";
}
