import Anthropic from "@anthropic-ai/sdk";
import { db, relationalCapsulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ChatMessage } from "../chat/lead-extractor";
import { trackAIUsage } from "../../lib/ai-usage";

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

export interface StructuredProfile {
  peso: string;
  altura: string;
  posicao_sono: string;
  condicoes: string;
  firmeza_preferida: string;
  uso: string;
  tamanho_cama: string;
  orcamento: string;
  estagio_compra: string;
}

export function getMemoryConfidence(daysSince: number | null): number {
  if (daysSince === null) return 0.5;
  if (daysSince === 0) return 1.0;
  if (daysSince <= 7) return 0.85;
  if (daysSince <= 30) return 0.6;
  return 0; // cold — mais de 30 dias: não reinjetar contexto antigo
}

export function parseStructuredProfile(capsule: string): StructuredProfile | null {
  const match = capsule.match(/\[PERFIL_ESTRUTURADO\]([\s\S]*?)(?:\[|$)/);
  if (!match) return null;

  const block = match[1];
  const get = (key: string): string => {
    const m = block.match(new RegExp(`${key}:\\s*(.+)`));
    return m ? m[1].trim() : "desconhecido";
  };

  return {
    peso: get("peso"),
    altura: get("altura"),
    posicao_sono: get("posicao_sono"),
    condicoes: get("condicoes"),
    firmeza_preferida: get("firmeza_preferida"),
    uso: get("uso"),
    tamanho_cama: get("tamanho_cama"),
    orcamento: get("orcamento"),
    estagio_compra: get("estagio_compra"),
  };
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
  state: CapsuleState,
  confidence = 1.0
): string {
  const daysSince =
    state.lastContactAt !== null
      ? Math.floor((Date.now() - state.lastContactAt.getTime()) / 86_400_000)
      : null;

  const recencyLabel =
    daysSince === null
      ? ""
      : daysSince === 0
        ? "hoje"
        : `${daysSince} dia${daysSince !== 1 ? "s" : ""} atrás`;

  const profile = parseStructuredProfile(state.capsule);
  const KNOWN = "✓";
  const MISSING = "✗";

  const qualificationLines: string[] = [];
  if (profile) {
    const fields: [keyof StructuredProfile, string][] = [
      ["peso", "Peso"],
      ["altura", "Altura"],
      ["posicao_sono", "Posição de dormir"],
      ["condicoes", "Condições de saúde"],
      ["firmeza_preferida", "Preferência de firmeza"],
      ["uso", "Uso (individual/casal)"],
      ["tamanho_cama", "Tamanho da cama"],
    ];

    const missing: string[] = [];
    for (const [key, label] of fields) {
      if (profile[key] !== "desconhecido") {
        qualificationLines.push(`${KNOWN} ${label}: ${profile[key]}`);
      } else {
        qualificationLines.push(`${MISSING} ${label}: desconhecido`);
        missing.push(label.toLowerCase());
      }
    }
    if (missing.length > 0) {
      qualificationLines.push(`→ Antes de recomendar, coletar: ${missing.join(", ")}`);
    }
  }

  // Strip the structured block from the relational text shown to the AI
  const relationalText = state.capsule
    .replace(/\[PERFIL_ESTRUTURADO\][\s\S]*$/, "")
    .trim();

  const resumeInstruction =
    confidence < 0.75
      ? "O cliente faz algum tempo não visita. Retome com leveza, não force continuidade se o contexto for vago."
      : "Retome pelo contexto real da cápsula acima: mencione algo específico (dor, produto, objeção). Se vago, abra com pergunta de continuidade natural.";

  const lines = [
    "[RESTORE_STATE]",
    name ? `Cliente: ${name}` : "Cliente recorrente",
    recencyLabel ? `Último contato: ${recencyLabel}` : "",
    state.sessionCount > 1 ? `Sessões anteriores: ${state.sessionCount}` : "",
    "",
    "Estado relacional:",
    relationalText,
    "",
    ...(qualificationLines.length > 0
      ? ["[PERFIL_QUALIFICAÇÃO]", ...qualificationLines, ""]
      : []),
    "Instrução de retomada:",
    name
      ? `O cliente se chama ${name}. Use o nome naturalmente na conversa.`
      : "Você não sabe o nome do cliente. Pergunte apenas em momento natural (ex: ao oferecer orçamento). Não interrompa a conversa para pedir o nome como primeira ação.",
    resumeInstruction,
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
      max_tokens: 600,
      system: `Você é um sistema de memória comercial especializado em vendas consultivas de colchões.
Analise a conversa e gere a saída em DUAS PARTES obrigatórias, nesta ordem exata:

PARTE 1 — CÁPSULA RELACIONAL (máximo 200 palavras):
Texto corrido, como notas de um vendedor experiente. Capture:
- perfil psicológico do cliente (racional, emocional, técnico, inseguro, etc.)
- dor principal mencionada (lombar, cervical, calor, etc.)
- objeção dominante (preço, indecisão, influência de terceiros, etc.)
- nível de intenção de compra
- o que gerou confiança na conversa
- o que gerou resistência
- próximo passo ideal para retomar o atendimento
- detalhes pessoais relevantes (parceiro influencia, tem hérnia, tem filhos, etc.)
NÃO inclua nomes de produtos específicos ou preços. Foque em psicologia, comportamento e estado emocional.

PARTE 2 — PERFIL ESTRUTURADO (obrigatório, preencher com dados explícitos da conversa):
[PERFIL_ESTRUTURADO]
peso: [valor em kg OU "desconhecido"]
altura: [valor em cm OU "desconhecido"]
posicao_sono: [costas|lado|barriga|mista|desconhecido]
condicoes: [lista separada por vírgula OU "nenhuma"]
firmeza_preferida: [macio|médio|firme|desconhecido]
uso: [individual|casal|desconhecido]
tamanho_cama: [solteiro|casal|queen|king|desconhecido]
orcamento: [faixa de valor OU "desconhecido"]
estagio_compra: [DISCOVERY|RECOMMENDATION|CLOSING|desconhecido]

REGRA CRÍTICA: Use APENAS dados explicitamente mencionados na conversa. Nunca infira ou estime.`,
      messages: [
        {
          role: "user",
          content: `${contextSection}Conversa:\n${transcript}\n\nGere a cápsula relacional seguida do perfil estruturado.`,
        },
      ],
    });

    const HAIKU_INPUT_MTK = 0.80, HAIKU_OUTPUT_MTK = 4.0;
    const costUsd = parseFloat((
      (response.usage.input_tokens / 1e6) * HAIKU_INPUT_MTK +
      (response.usage.output_tokens / 1e6) * HAIKU_OUTPUT_MTK
    ).toFixed(6));

    void trackAIUsage({
      lojaId,
      modelo: "claude-haiku-4-5-20251001",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      custoEstimado: costUsd,
      contexto: "capsule",
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
