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
      ? `Último contato: ${daysSince === 0 ? "hoje" : `${daysSince} dia${daysSince !== 1 ? "s" : ""} atrás`}`
      : "",
    state.sessionCount > 1 ? `Sessões anteriores: ${state.sessionCount}` : "",
    "",
    "Estado relacional:",
    state.capsule,
    "",
    "Instrução: retome o atendimento de forma natural e contínua. Nunca trate este cliente como desconhecido — você tem o histórico acima. Demonstre memória do contexto sem citar explicitamente que tem um 'estado salvo'.",
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
