interface ExecutarAgenteParams {
  mensagem: string;
  contexto: Record<string, unknown>;
  modelo: string;
}

function gerarPrompt(contexto: Record<string, unknown>): string {
  return `Você é um vendedor especialista da Castor, uma loja de colchões e móveis.

REGRAS ABSOLUTAS:
- NUNCA invente preços. Use apenas valores do CONTEXTO abaixo.
- Se tiver preço real disponível, marque com "contexto_real" no raciocínio interno.
- Seja direto, empático e tente converter a venda.
- Respostas curtas (máximo 3 parágrafos).
- Se identificar intenção de compra clara, inclua "RECOMENDAR_PRODUTO" na resposta.

CONTEXTO:
${JSON.stringify(contexto, null, 2)}`;
}

export async function executarAgente({
  mensagem,
  contexto,
  modelo,
}: ExecutarAgenteParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 600,
      system: gerarPrompt(contexto),
      messages: [{ role: "user", content: mensagem }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text: string }>;
  };

  return data?.content?.[0]?.text ?? "Não consegui processar sua mensagem.";
}
