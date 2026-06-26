// Sincroniza preços do banco de dados (atualizados pelo Crowley) → catálogo Meta.
// Requer: DATABASE_URL e META_ACCESS_TOKEN no ambiente.
// Run: META_ACCESS_TOKEN=xxx pnpm --filter @workspace/scripts run atualizar-precos-meta

import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";

const META_API_VERSION = "v19.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaProduct {
  product_id: string;
  nome: string;
  preco_meta_centavos: number;
  /** Termos para buscar o produto correspondente no banco */
  search: { family: string; medidas: string; categoria: string };
}

interface Resultado {
  product_id: string;
  nome: string;
  status: "atualizado" | "igual" | "erro" | "sem_match";
  preco_meta?: string;
  preco_db?: string;
  error?: string;
}

// Mapeamento fixo: product_id Meta → critérios de busca no banco.
// preco_meta_centavos = preço atual no Meta (para comparação / log).
const META_PRODUTOS: MetaProduct[] = [
  { product_id: "26965712579742942", nome: "Cama Box + Colchão Casal Silver Star Air One Face Híbrido 138x188x59cm", preco_meta_centavos: 339500, search: { family: "%Silver Star Air%", medidas: "138x188", categoria: "cama-box-colchao" } },
  { product_id: "26945082198469997", nome: "Cama Box + Colchão King Premium Amazon Gel One Face Pocket 193x203x59cm", preco_meta_centavos: 599000, search: { family: "%Premium Amazon Gel%", medidas: "193x203", categoria: "cama-box-colchao" } },
  { product_id: "8838602569485642", nome: "Colchão Solteiro Silver Star Air One Face Híbrido 88x188x32cm", preco_meta_centavos: 179900, search: { family: "%Silver Star Air%", medidas: "88x188", categoria: "colchoes" } },
  { product_id: "8657591824271626", nome: "Colchão Casal Silver Star Air One Face Híbrido 138x188x32cm", preco_meta_centavos: 259000, search: { family: "%Silver Star Air%", medidas: "138x188", categoria: "colchoes" } },
  { product_id: "8522047044482645", nome: "Conjunto Class New Pocket® One Face", preco_meta_centavos: 289000, search: { family: "%Class New%", medidas: "138x188", categoria: "cama-box-colchao" } },
  { product_id: "8485596271484082", nome: "Cama Box + Colchão Queen New Class One Face Pocket 158x198x52cm", preco_meta_centavos: 349000, search: { family: "%Class New%", medidas: "158x198", categoria: "cama-box-colchao" } },
  { product_id: "8430466240325234", nome: "Cama Box + Colchão Queen Silver Star Air One Face Híbrido 158x198x59cm", preco_meta_centavos: 429000, search: { family: "%Silver Star Air%", medidas: "158x198", categoria: "cama-box-colchao" } },
  { product_id: "8393449164068911", nome: "Cama Box Baú Queen Vellus Cinza 158x198x35cm", preco_meta_centavos: 269000, search: { family: "%Vellus%", medidas: "158x198", categoria: "cama-box" } },
  { product_id: "8308304619249038", nome: "Colchão Queen Silver Star Air One Face Híbrido 158x198x32cm", preco_meta_centavos: 319000, search: { family: "%Silver Star Air%", medidas: "158x198", categoria: "colchoes" } },
  { product_id: "8241312532623394", nome: "Colchão King Silver Star Air One Face Híbrido 193x203x32cm", preco_meta_centavos: 419000, search: { family: "%Silver Star Air%", medidas: "193x203", categoria: "colchoes" } },
  { product_id: "8031329426965767", nome: "Cama Box Baú Queen Vellus Bege 158x198x35cm", preco_meta_centavos: 279000, search: { family: "%Vellus%", medidas: "158x198", categoria: "cama-box" } },
  { product_id: "7569264893176080", nome: "Cama Box + Colchão Casal Premium Amazon Gel One Face Pocket 138x188x59cm", preco_meta_centavos: 389000, search: { family: "%Premium Amazon Gel%", medidas: "138x188", categoria: "cama-box-colchao" } },
  { product_id: "7535025993266969", nome: "Cama Box + Colchão Solteiro Silver Star Air One Face Híbrido 88x188x59cm", preco_meta_centavos: 248000, search: { family: "%Silver Star Air%", medidas: "88x188", categoria: "cama-box-colchao" } },
];

function centavosToMeta(centavos: number): string {
  return `${(centavos / 100).toFixed(2)} BRL`;
}

function centavosToDisplay(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buscarPrecoDB(meta: MetaProduct): Promise<number | null> {
  const rows = await db
    .select({ precoBase: produtosTable.precoBase, nome: produtosTable.nome })
    .from(produtosTable)
    .where(
      and(
        eq(produtosTable.lojaId, 1),
        eq(produtosTable.disponivel, true),
        eq(produtosTable.categoria, meta.search.categoria),
        ilike(produtosTable.nome, meta.search.family),
        or(
          ilike(produtosTable.medidas, `%${meta.search.medidas}%`),
          ilike(produtosTable.nome, `%${meta.search.medidas}%`),
        ),
      ),
    )
    .limit(1);

  if (rows.length === 0 || !rows[0].precoBase) return null;
  return Math.round(Number(rows[0].precoBase) * 100);
}

async function atualizarPrecoMeta(
  productId: string,
  precoCentavos: number,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${META_BASE_URL}/${productId}`;
  const priceStr = centavosToMeta(precoCentavos);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: priceStr, access_token: accessToken }),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const msg =
        (data as { error?: { message?: string } }).error?.message ??
        `HTTP ${response.status}`;
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function run() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[sync-meta] META_ACCESS_TOKEN não definido.");
    console.error("Uso: META_ACCESS_TOKEN=xxx pnpm --filter @workspace/scripts run atualizar-precos-meta");
    process.exit(1);
  }

  console.log(`[sync-meta] Sincronizando ${META_PRODUTOS.length} produtos DB → Meta...\n`);

  const resultados: Resultado[] = [];

  for (let i = 0; i < META_PRODUTOS.length; i++) {
    const meta = META_PRODUTOS[i];

    const precoDB = await buscarPrecoDB(meta);

    if (precoDB === null) {
      console.log(JSON.stringify({
        event: "price_sync", product_id: meta.product_id,
        nome: meta.nome, status: "sem_match",
      }));
      resultados.push({ product_id: meta.product_id, nome: meta.nome, status: "sem_match" });
      continue;
    }

    if (precoDB === meta.preco_meta_centavos) {
      console.log(JSON.stringify({
        event: "price_sync", product_id: meta.product_id,
        nome: meta.nome, status: "igual", preco: centavosToDisplay(precoDB),
      }));
      resultados.push({
        product_id: meta.product_id, nome: meta.nome, status: "igual",
        preco_meta: centavosToDisplay(meta.preco_meta_centavos),
        preco_db: centavosToDisplay(precoDB),
      });
      continue;
    }

    const result = await atualizarPrecoMeta(meta.product_id, precoDB, accessToken);

    console.log(JSON.stringify({
      event: "price_sync", product_id: meta.product_id, nome: meta.nome,
      preco_meta: centavosToDisplay(meta.preco_meta_centavos),
      preco_db: centavosToDisplay(precoDB),
      status: result.ok ? "atualizado" : "erro",
      ...(result.error ? { error: result.error } : {}),
    }));

    resultados.push({
      product_id: meta.product_id, nome: meta.nome,
      status: result.ok ? "atualizado" : "erro",
      preco_meta: centavosToDisplay(meta.preco_meta_centavos),
      preco_db: centavosToDisplay(precoDB),
      ...(result.error ? { error: result.error } : {}),
    });

    if (i < META_PRODUTOS.length - 1) await delay(200);
  }

  const atualizados = resultados.filter((r) => r.status === "atualizado").length;
  const iguais = resultados.filter((r) => r.status === "igual").length;
  const erros = resultados.filter((r) => r.status === "erro").length;
  const semMatch = resultados.filter((r) => r.status === "sem_match").length;

  console.log("\n--- RESUMO ---");
  console.table(
    resultados.map((r) => ({
      Produto: r.nome.substring(0, 55),
      "Meta": r.preco_meta ?? "-",
      "DB": r.preco_db ?? "-",
      Status: r.status === "atualizado" ? "✓ atualizado"
        : r.status === "igual" ? "= igual"
        : r.status === "sem_match" ? "? sem match"
        : `✗ ${r.error ?? "erro"}`,
    })),
  );

  console.log(`\nTotal: ${atualizados} atualizados, ${iguais} iguais, ${erros} erros, ${semMatch} sem match no DB`);
  process.exit(erros > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("[sync-meta] Fatal:", err);
  process.exit(1);
});
