import Anthropic from "@anthropic-ai/sdk";
import { autoSalvarOrcamentoDaConversa } from "../../lib/orcamento-utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExtracaoLead {
  nomeCliente: string | null;
  telefone: string | null;
  produtoIds: number[];
  deveSalvar: boolean;
}

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new Anthropic({ baseURL: "https://api.anthropic.com", apiKey });
}

async function extrairDadosConversa(
  messages: ChatMessage[],
  ultimaRespostaAssistente: string
): Promise<ExtracaoLead | null> {
  if (messages.length < 3) return null;
  const client = getAnthropicClient();
  if (!client) return null;

  const conversa = messages
    .map((m) => `${m.role === "user" ? "Cliente" : "Assistente"}: ${m.content}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: `Analise a conversa e extraia dados de lead. Retorne JSON com:
- nomeCliente: string | null
- telefone: string | null (apenas dígitos)
- produtoIds: number[] (IDs mencionados no formato [ID:X])
- deveSalvar: boolean (true se tiver nome + telefone + produto)`,
      messages: [{
        role: "user",
        content: `Conversa:\n${conversa}\n\nÚltima resposta do assistente:\n${ultimaRespostaAssistente}`,
      }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : null;
    if (!text) return null;

    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(clean) as ExtracaoLead;
    if (typeof data !== "object" || data === null) return null;
    if (!Array.isArray(data.produtoIds)) data.produtoIds = [];
    return data;
  } catch {
    return null;
  }
}

export async function processarLeadDaConversa(
  messages: ChatMessage[],
  ultimaRespostaAssistente: string
): Promise<void> {
  const dados = await extrairDadosConversa(messages, ultimaRespostaAssistente);
  if (!dados?.deveSalvar) return;
  if (!dados.nomeCliente || !dados.telefone || !dados.produtoIds.length) return;
  await autoSalvarOrcamentoDaConversa(dados.nomeCliente, dados.telefone, dados.produtoIds);
}
