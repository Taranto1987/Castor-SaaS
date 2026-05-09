import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const LOJAS_SEED = [
  {
    id: 1,
    slug: "cabo-frio",
    nome: "Castor Cabo Frio",
    operacao: "cabo_frio",
    responsavel: "Thalles",
    whatsappNumero: "5522992410112",
    whatsappDisplay: "(22) 99241-0112",
    cidade: "Cabo Frio",
    ativa: true,
  },
  {
    id: 2,
    slug: "araruama",
    nome: "Castor Araruama",
    operacao: "araruama",
    responsavel: null,
    whatsappNumero: "5522988249183",
    whatsappDisplay: "(22) 98824-9183",
    cidade: "Araruama",
    ativa: true,
  },
];

export async function seedLojas(): Promise<void> {
  try {
    // Use OVERRIDING SYSTEM VALUE so explicit serial IDs (1, 2) are accepted.
    // ON CONFLICT DO NOTHING means this is idempotent — safe to run on every startup.
    for (const loja of LOJAS_SEED) {
      await db.execute(
        sql`INSERT INTO lojas (id, slug, nome, operacao, responsavel, whatsapp_numero, whatsapp_display, cidade, ativa)
            OVERRIDING SYSTEM VALUE
            VALUES (${loja.id}, ${loja.slug}, ${loja.nome}, ${loja.operacao}, ${loja.responsavel ?? null},
                    ${loja.whatsappNumero ?? null}, ${loja.whatsappDisplay ?? null}, ${loja.cidade ?? null}, ${loja.ativa})
            ON CONFLICT (id) DO NOTHING`,
      );
    }
    // Advance the serial sequence past the seeded IDs to avoid future conflicts.
    await db.execute(
      sql`SELECT setval(pg_get_serial_sequence('lojas', 'id'), GREATEST((SELECT MAX(id) FROM lojas), 1))`,
    );
    console.log("[Seed] Lojas verificadas/seedadas.");
  } catch (err) {
    console.error("[Seed] Erro ao seedar lojas:", err);
  }
}
