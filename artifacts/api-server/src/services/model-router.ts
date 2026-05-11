import type { MessageType } from "../core/classifier.js";

type ModelName = "claude-haiku-4-5-20251001" | "claude-sonnet-4-6";

export function escolherModelo(tipo: MessageType): ModelName {
  switch (tipo) {
    case "saudacao":
    case "preco":
      return "claude-haiku-4-5-20251001";
    case "intencao_compra":
    case "logistica":
    case "geral":
    default:
      return "claude-sonnet-4-6";
  }
}
