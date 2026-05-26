import Anthropic from "@anthropic-ai/sdk";
import { db, relationalCapsulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ChatMessage } from "../chat/lead-extractor";

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new Anthropic({ baseURL: "https://api.anthropic.com", apiKey });
}

export interface CapsuleState {
  capsule: string;
  lastContactAt: Date | null;
  sessionCount: number;
}

export async function loadCapsule(customerId: number): Promise<CapsuleState | null> {
  const rows = await db
    .select()
    .from(relationalCapsulesTable)
    .where(eq(relationalCapsulesTable.customerId, customerId))
    .limit(1);

  if (!rows[0]) return null;
  return {
    capsule: rows[0].capsule,
    lastContactAt: rows[0].lastContactAt,
    sessionCount: rows[0].sessionCount,
  };
}

export function buildStateBlock(
  name: string | null,
  state: CapsuleState
): string {
  const daysSince =
    state.lastContactAt !== null
      ? Math.floor((Date.now() - state.lastContactAt.getTime()) / 86_400_000)
      : null;

  const lines = [
    "[RESTORE_STATE]",
    name ? `Cliente: ${name}` : "Cliente recorrente",
    daysSince !== null
      ? `Último contato: ${
          daysSince === 0 ? "hoje"
          : daysSince <= 3 ? "há poucos dias"
          : daysSince <= 14 ? "há algumas semanas"
          : "há mais de um mês"
        }`
      : "",
    state.sessionCount > 1 ? `Sessões anteriores: ${state.sessionCount}` : "",
    "",
    "Estado relacional:",
    state.capsule,
    "",
    "Instrução de retomada:",
    name
      ? `O cliente se chama ${name}. Use o nome naturalmente na conversa.`
      : "Você não sabe o nome do cliente ainda. Antes de qualquer outra coisa, peça o nome de forma natural (ex: 'Pode me dizer seu nome?'). Nunca diga 'Que bom te ver de volta!' ou qualquer saudação de reencuentro sem antes saber o nome — isso soaria artificial.",
    "Retome pelo contexto real da cápsula acima: mencione algo específico do que foi discutido (dor, produto, objeção). Se a cápsula for muito vaga, abra com uma pergunta que dê continuidade natural à jornada do cliente.",
    "Nunca mencione que tem um 'estado salvo', 'memória' ou 'registro'. Aja como um vendedor experiente que simplesmente lembra.",
  ].filter((l) => l !== undefined);

  return lines.join("\n").trim();
}

export async function generateAndSaveCapsule(
  customerId: number,
  lojaId: number,
  messages: ChatMessage[],
  previousCapsule: string | null,
  sessionCount: number
): Promise<void> {
  const client = getAnthropicClient();
  if (!client || messages.length < 2) return;

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Cliente" : "ThallesZzz"}: ${m.content}`)
    .join("\n");

  const contextSection = previousCapsule
    ? `Estado anterior:\n${previousCapsule}\n\n`
    : "";

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `Você é um sistema de memória comercial especializado em vendas consultivas de colchões.
Analise a conversa e gere uma CÁPSULA DE ESTADO RELACIONAL compacta (máximo 200 palavras).

Capture:
- perfil psicológico do cliente (racional, emocional, técnico, inseguro, etc.)
- dor principal mencionada (lombar, cervical, calor, etc.)
- objeção dominante (preço, indecisão, influência de terceiros, etc.)
- nível de intenção de compra
- o que gerou confiança na conversa
- o que gerou resistência
- próximo passo ideal para retomar o atendimento
- detalhes pessoais relevantes (parceiro influencia, tem hérnia, tem filhos, etc.)

Formato: texto corrido, direto, como notas de um vendedor experiente.
NÃO inclua nomes de produtos específicos ou preços.
Foque em psicologia, comportamento e estado emocional.`,
      messages: [
        {
          role: "user",
          content: `${contextSection}Conversa:\n${transcript}\n\nGere a cápsula de estado relacional.`,
        },
      ],
    });

    const capsule =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!capsule) return;

    const existing = await db
      .select({ id: relationalCapsulesTable.id })
      .from(relationalCapsulesTable)
      .where(eq(relationalCapsulesTable.customerId, customerId))
      .limit(1);

    if (existing[0]) {
      await db
        .update(relationalCapsulesTable)
        .set({
          capsule,
          sessionCount: sessionCount + 1,
          lastContactAt: new Date(),
          atualizadoEm: new Date(),
        })
        .where(eq(relationalCapsulesTable.customerId, customerId));
    } else {
      await db
        .insert(relationalCapsulesTable)
        .values({ customerId, lojaId, capsule });
    }
  } catch (err) {
    console.error("[Memory] Capsule generation failed:", err);
  }
}
