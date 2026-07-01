import Anthropic from "@anthropic-ai/sdk";
import { db, relationalCapsulesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const HAIKU = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Você é um sistema de memória CRM para uma loja de colchões Castor.
Sua função é extrair e consolidar informações relevantes do cliente a partir de conversas no WhatsApp.

Retorne APENAS um JSON válido com os campos:
- nome: string | null
- dores: string[] (ex: "dor nas costas", "calor excessivo", "casal divide cama", "ronco")
- interesses: string[] (modelos, tamanhos, tipos: "colchão queen", "molas ensacadas", "látex")
- orcamento: string | null (ex: "R$ 1.500 a 2.000")
- urgencia: string | null (ex: "alta - filha casa em agosto")
- estagio: "prospecto" | "interessado" | "negociando" | "comprou"
- notas: string | null (observações livres relevantes)

Preserve dados existentes. Corrija apenas se a nova troca contradizer explicitamente. Não invente informações não mencionadas.`;

export async function extractAndUpdateCapsule(
  lojaId: number,
  customerId: number,
  userMsg: string,
  botMsg: string,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return;

  const [existing] = await db
    .select()
    .from(relationalCapsulesTable)
    .where(eq(relationalCapsulesTable.customerId, customerId))
    .limit(1);

  const currentCapsule = existing?.capsule ?? "{}";

  const client = new Anthropic({ apiKey });

  let result;
  try {
    result = await client.messages.create({
      model: HAIKU,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Capsule atual:\n${currentCapsule}\n\nNova troca:\nCliente: ${userMsg}\nAtendente: ${botMsg}\n\nRetorne o JSON atualizado.`,
        },
      ],
    });
  } catch (err) {
    logger.error({ err, customerId }, "preference-extractor: Haiku call failed");
    return;
  }

  const block = result.content[0];
  if (block.type !== "text") return;

  const newCapsule = block.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  try {
    JSON.parse(newCapsule);
  } catch {
    logger.warn({ customerId, newCapsule }, "preference-extractor: invalid JSON returned, skipping");
    return;
  }

  await db
    .insert(relationalCapsulesTable)
    .values({
      customerId,
      lojaId,
      capsule: newCapsule,
      sessionCount: 1,
      lastContactAt: new Date(),
    })
    .onConflictDoUpdate({
      target: relationalCapsulesTable.customerId,
      set: {
        capsule: newCapsule,
        sessionCount: sql`relational_capsules.session_count + 1`,
        lastContactAt: new Date(),
        atualizadoEm: new Date(),
      },
    });
}
