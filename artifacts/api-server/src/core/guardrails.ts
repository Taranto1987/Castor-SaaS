export function validarResposta(resposta: string): string {
  // IA não pode inventar preços — só pode citá-los se vieram do contexto real
  if (resposta.includes("R$") && !resposta.includes("contexto_real")) {
    throw new Error("Guardrail: IA tentou inventar preço sem contexto real");
  }

  return resposta;
}

export function sanitizarEntrada(mensagem: string): string {
  // Remove tentativas de injeção de prompt
  return mensagem
    .replace(/ignore (all )?(previous|prior) instructions?/gi, "")
    .replace(/system:/gi, "")
    .trim();
}
