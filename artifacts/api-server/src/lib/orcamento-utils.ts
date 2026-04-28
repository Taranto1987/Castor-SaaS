import { db } from "@workspace/db";
import { orcamentosTable } from "@workspace/db/schema";

interface ConversaParams {
  tenant: string;
  mensagens: Array<{ role: string; content: string }>;
  respostaFinal: string;
}

const INTENCAO_KEYWORDS = [
  "qual o preço",
  "quanto custa",
  "valor do",
  "posso comprar",
  "quero pedir",
  "fazer pedido",
  "finalizar",
  "quero comprar",
  "encomend",
];

export async function autoSalvarOrcamentoDaConversa({
  tenant,
  mensagens,
  respostaFinal,
}: ConversaParams): Promise<void> {
  if (mensagens.length < 3) return;

  const userText = mensagens
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const temIntencao = INTENCAO_KEYWORDS.some((kw) => userText.includes(kw));
  if (!temIntencao) return;

  const textoConversa = [
    ...mensagens.map((m) => `[${m.role}] ${m.content}`),
    `[assistant] ${respostaFinal}`,
  ]
    .join("\n")
    .slice(0, 2000);

  try {
    await db.insert(orcamentosTable).values({
      tenantId: tenant,
      cliente: "Lead Chat",
      produtosJson: [],
      texto: textoConversa,
      status: "chat_lead",
      vendedor: "ThallesZzz",
    });
  } catch {
    // best-effort — never break the chat flow
  }
}
