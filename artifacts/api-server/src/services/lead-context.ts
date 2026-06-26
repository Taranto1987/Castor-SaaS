import Anthropic from "@anthropic-ai/sdk";
import { db, leadContextsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { LeadContext } from "@workspace/db";
import { trackAIUsage } from "../lib/ai-usage";

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new Anthropic({ baseURL: "https://api.anthropic.com", apiKey });
}

export type { LeadContext };

export type LeadContextUpdate = Partial<{
  nome: string | null;
  ultimoInteresse: string | null;
  ultimaCategoria: string | null;
  ultimoOrcamentoId: number | null;
  faixaPreco: string | null;
  tags: string[] | null;
  temperatura: string | null;
  ultimoContatoEm: Date | null;
  ultimoResumoIA: string | null;
}>;

export async function getLeadContext(
  telefone: string,
  lojaId: number
): Promise<LeadContext | null> {
  const rows = await db
    .select()
    .from(leadContextsTable)
    .where(and(eq(leadContextsTable.telefone, telefone), eq(leadContextsTable.lojaId, lojaId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertLeadContext(
  telefone: string,
  lojaId: number,
  fields: LeadContextUpdate
): Promise<void> {
  await db
    .insert(leadContextsTable)
    .values({ telefone, lojaId, ...fields, ultimoContatoEm: fields.ultimoContatoEm ?? new Date() })
    .onConflictDoUpdate({
      target: [leadContextsTable.telefone, leadContextsTable.lojaId],
      set: {
        ...fields,
        ultimoContatoEm: fields.ultimoContatoEm ?? new Date(),
        atualizadoEm: new Date(),
      },
    });
}

interface LeadContextFields {
  ultimoInteresse?: string;
  ultimaCategoria?: string;
  faixaPreco?: string;
  tags?: string[];
  temperatura?: string;
  ultimoResumoIA?: string;
}

export async function generateAndSaveLeadContext(
  telefone: string,
  lojaId: number,
  nome: string | null,
  messages: { role: string; content: string }[]
): Promise<void> {
  const client = getAnthropicClient();
  if (!client || messages.length < 2) return;

  const transcript = messages
    .map((m) => `${m.role === "user" ? "Cliente" : "Assistente"}: ${m.content}`)
    .join("\n");

  try {
    const HAIKU_INPUT_MTK = 0.80, HAIKU_OUTPUT_MTK = 4.0;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `Você é um sistema de CRM para loja de colchões. Analise a conversa e extraia um JSON estruturado com o contexto comercial do lead.

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "ultimoInteresse": "descrição do que o cliente quer (ex: colchão queen para casal com dor lombar)",
  "ultimaCategoria": "colchoes|cama-box|cama-box-colchao|travesseiros|protetor|roupa-de-cama|desconhecido",
  "faixaPreco": "ex: 1500-2500 (ou null se não mencionado)",
  "tags": ["array", "de", "palavras-chave", "relevantes"],
  "temperatura": "frio|morno|quente",
  "ultimoResumoIA": "resumo em 100-150 palavras: dor do cliente, produto de interesse, objeções, nível de intenção, próximo passo ideal"
}

Para "temperatura": frio = só navegando, morno = interesse real mas sem urgência, quente = quer comprar em breve.`,
      messages: [
        {
          role: "user",
          content: `Conversa:\n${transcript}\n\nExtraia o contexto comercial em JSON.`,
        },
      ],
    });

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
      contexto: "lead-context",
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!rawText) return;

    let parsed: LeadContextFields;
    try {
      parsed = JSON.parse(rawText) as LeadContextFields;
    } catch {
      return;
    }

    await upsertLeadContext(telefone, lojaId, {
      nome: nome ?? undefined,
      ultimoInteresse: parsed.ultimoInteresse ?? undefined,
      ultimaCategoria: parsed.ultimaCategoria ?? undefined,
      faixaPreco: parsed.faixaPreco ?? undefined,
      tags: parsed.tags ?? undefined,
      temperatura: parsed.temperatura ?? undefined,
      ultimoResumoIA: parsed.ultimoResumoIA ?? undefined,
      ultimoContatoEm: new Date(),
    });
  } catch (err) {
    console.error("[LeadContext] Generation failed:", err);
  }
}

export function buildLeadMemoryBlock(ctx: LeadContext): string {
  const diasDesde =
    ctx.ultimoContatoEm !== null
      ? Math.floor((Date.now() - ctx.ultimoContatoEm.getTime()) / 86_400_000)
      : null;

  const lines = [
    "[CONTEXTO DO LEAD]",
    ctx.nome ? `Nome: ${ctx.nome}` : null,
    diasDesde !== null
      ? `Último contato: ${diasDesde === 0 ? "hoje" : `${diasDesde} dia${diasDesde !== 1 ? "s" : ""} atrás`}`
      : null,
    ctx.ultimoInteresse ? `Interesse: ${ctx.ultimoInteresse}` : null,
    ctx.faixaPreco ? `Faixa de preço: R$ ${ctx.faixaPreco}` : null,
    ctx.temperatura ? `Temperatura: ${ctx.temperatura}` : null,
    ctx.tags && ctx.tags.length > 0 ? `Tags: ${ctx.tags.join(", ")}` : null,
    ctx.ultimoResumoIA ? `\nResumo:\n${ctx.ultimoResumoIA}` : null,
  ].filter((l): l is string => l !== null);

  return lines.join("\n").trim();
}
