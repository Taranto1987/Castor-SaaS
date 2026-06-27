// Seed initial Meta catalog config + product mappings for Cabo Frio (lojaId=1).
//
// Prerequisites:
// 1. Database tables created (run: pnpm --filter @workspace/db run push)
// 2. Products already crawled (run crawler first if needed)
//
// Run: pnpm --filter @workspace/scripts run seed-meta-catalogo

import { db } from "@workspace/db";
import {
  metaCatalogoConfigTable,
  metaProdutosTable,
  produtosTable,
} from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

const LOJA_ID = 1;
const CATALOG_ID = "628452355881149";

const META_PRODUCTS = [
  { metaProductId: "26965712579742942", retailerId: "Djg1GBeYag", family: "Silver Star Air", medidas: "138x188", tipo: "cama-box-colchao" },
  { metaProductId: "26945082198469997", retailerId: "71qVTMjDEX", family: "Premium Amazon Gel", medidas: "193x203", tipo: "cama-box-colchao" },
  { metaProductId: "8838602569485642", retailerId: "lwEequBE5G", family: "Silver Star Air", medidas: "88x188", tipo: "colchao" },
  { metaProductId: "8657591824271626", retailerId: "2JoVx4euVl", family: "Silver Star Air", medidas: "138x188", tipo: "colchao" },
  { metaProductId: "8522047044482645", retailerId: "USRlkEqtEq", family: "Class New", medidas: "138x188", tipo: "cama-box-colchao" },
  { metaProductId: "8485596271484082", retailerId: "AhwvqTsHoW", family: "Class New", medidas: "158x198", tipo: "cama-box-colchao" },
  { metaProductId: "8430466240325234", retailerId: "HadMfKL4mL", family: "Silver Star Air", medidas: "158x198", tipo: "cama-box-colchao" },
  { metaProductId: "8393449164068911", retailerId: "OJcT4bc1Zp", family: "Vellus", medidas: "158x198", tipo: "cama-box-bau", cor: "Cinza" },
  { metaProductId: "8308304619249038", retailerId: "v1Wqf6T5Fw", family: "Silver Star Air", medidas: "158x198", tipo: "colchao" },
  { metaProductId: "8241312532623394", retailerId: "Bjdwr1yC8r", family: "Silver Star Air", medidas: "193x203", tipo: "colchao" },
  { metaProductId: "8031329426965767", retailerId: "4x5NVwYM4I", family: "Vellus", medidas: "158x198", tipo: "cama-box-bau", cor: "Bege" },
  { metaProductId: "7569264893176080", retailerId: "K7WAYpHRUp", family: "Premium Amazon Gel", medidas: "138x188", tipo: "cama-box-colchao" },
  { metaProductId: "7535025993266969", retailerId: "xCDNsZZJuY", family: "Silver Star Air", medidas: "88x188", tipo: "cama-box-colchao" },
];

async function findProductId(meta: typeof META_PRODUCTS[number]): Promise<number | null> {
  const products = await db.select({ id: produtosTable.id, nome: produtosTable.nome, categoria: produtosTable.categoria })
    .from(produtosTable)
    .where(and(
      eq(produtosTable.lojaId, LOJA_ID),
      ilike(produtosTable.nome, `%${meta.family}%`),
      ilike(produtosTable.nome, `%${meta.medidas}%`),
    ));

  if (products.length === 0) return null;
  if (products.length === 1) return products[0].id;

  for (const p of products) {
    const nameLower = p.nome.toLowerCase();

    if (meta.tipo === "colchao" && nameLower.startsWith("colchão") && !nameLower.includes("cama box")) {
      return p.id;
    }
    if (meta.tipo === "cama-box-bau" && nameLower.includes("baú")) {
      if (meta.cor && nameLower.includes(meta.cor.toLowerCase())) return p.id;
    }
    if (meta.tipo === "cama-box-colchao" && nameLower.includes("cama box") && !nameLower.includes("baú")) {
      return p.id;
    }
  }

  return products[0].id;
}

async function run() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[seed] META_ACCESS_TOKEN não definido.");
    console.error("Uso: META_ACCESS_TOKEN=xxx pnpm --filter @workspace/scripts run seed-meta-catalogo");
    process.exit(1);
  }

  console.log("[seed] Configurando Meta catálogo para Cabo Frio (lojaId=1)...\n");

  // Upsert config
  const [existing] = await db.select({ id: metaCatalogoConfigTable.id })
    .from(metaCatalogoConfigTable)
    .where(eq(metaCatalogoConfigTable.lojaId, LOJA_ID));

  if (existing) {
    await db.update(metaCatalogoConfigTable)
      .set({ catalogId: CATALOG_ID, accessToken, atualizadoEm: new Date() })
      .where(eq(metaCatalogoConfigTable.id, existing.id));
    console.log("[seed] Config atualizada.");
  } else {
    await db.insert(metaCatalogoConfigTable).values({
      lojaId: LOJA_ID, catalogId: CATALOG_ID, accessToken,
    });
    console.log("[seed] Config criada.");
  }

  // Map products
  let mapped = 0;
  let notFound = 0;

  for (const meta of META_PRODUCTS) {
    const produtoId = await findProductId(meta);

    if (!produtoId) {
      console.log(`[seed] ✗ Não encontrou: ${meta.family} ${meta.medidas} (${meta.tipo})`);
      notFound++;
      continue;
    }

    const [existingMapping] = await db.select({ id: metaProdutosTable.id })
      .from(metaProdutosTable)
      .where(and(
        eq(metaProdutosTable.metaProductId, meta.metaProductId),
        eq(metaProdutosTable.lojaId, LOJA_ID),
      ));

    if (existingMapping) {
      await db.update(metaProdutosTable)
        .set({ produtoId, retailerId: meta.retailerId, ativo: true })
        .where(eq(metaProdutosTable.id, existingMapping.id));
    } else {
      await db.insert(metaProdutosTable).values({
        lojaId: LOJA_ID,
        metaProductId: meta.metaProductId,
        retailerId: meta.retailerId,
        produtoId,
      });
    }

    console.log(`[seed] ✓ ${meta.family} ${meta.medidas} (${meta.tipo}) → produto #${produtoId}`);
    mapped++;
  }

  console.log(`\n[seed] Resultado: ${mapped} mapeados, ${notFound} não encontrados.`);
  process.exit(notFound > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
