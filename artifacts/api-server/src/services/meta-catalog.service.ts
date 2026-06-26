import { db } from "@workspace/db";
import { metaCatalogoConfigTable, metaProdutosTable, produtosTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

interface SyncDetail {
  metaProductId: string;
  produtoId: number;
  status: "ok" | "error";
  error?: string;
}

interface SyncResult {
  sincronizados: number;
  erros: number;
  detalhes: SyncDetail[];
}

async function graphPatch(
  metaProductId: string,
  body: Record<string, string>,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/${metaProductId}?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errorObj = data.error as Record<string, unknown> | undefined;
      return { ok: false, error: errorObj?.message as string ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sincronizarProdutos(lojaId: number): Promise<SyncResult> {
  const [config] = await db
    .select()
    .from(metaCatalogoConfigTable)
    .where(and(eq(metaCatalogoConfigTable.lojaId, lojaId), eq(metaCatalogoConfigTable.ativo, true)))
    .limit(1);

  if (!config) {
    throw new Error(`Meta Catalog config não encontrada para loja ${lojaId}`);
  }

  const mappings = await db
    .select({
      id: metaProdutosTable.id,
      metaProductId: metaProdutosTable.metaProductId,
      produtoId: metaProdutosTable.produtoId,
      retailerId: metaProdutosTable.retailerId,
    })
    .from(metaProdutosTable)
    .where(and(eq(metaProdutosTable.lojaId, lojaId), eq(metaProdutosTable.ativo, true)));

  const detalhes: SyncDetail[] = [];
  let sincronizados = 0;
  let erros = 0;

  for (const m of mappings) {
    try {
      const [produto] = await db
        .select({ precoBase: produtosTable.precoBase, disponivel: produtosTable.disponivel })
        .from(produtosTable)
        .where(and(eq(produtosTable.id, m.produtoId), eq(produtosTable.lojaId, lojaId)))
        .limit(1);

      if (!produto || !produto.precoBase) {
        detalhes.push({ metaProductId: m.metaProductId, produtoId: m.produtoId, status: "error", error: "Produto ou preço não encontrado" });
        erros++;
        console.log(JSON.stringify({ event: "meta_sync_skip", lojaId, metaProductId: m.metaProductId, reason: "produto_not_found" }));
        continue;
      }

      const priceCents = Math.round(Number(produto.precoBase) * 100);
      const result = await graphPatch(
        m.metaProductId,
        {
          price: `${priceCents} BRL`,
          availability: produto.disponivel ? "in stock" : "out of stock",
        },
        config.accessToken,
      );

      if (!result.ok) {
        detalhes.push({ metaProductId: m.metaProductId, produtoId: m.produtoId, status: "error", error: result.error });
        erros++;
        console.log(JSON.stringify({ event: "meta_sync_error", lojaId, metaProductId: m.metaProductId, error: result.error }));
        continue;
      }

      sincronizados++;
      detalhes.push({ metaProductId: m.metaProductId, produtoId: m.produtoId, status: "ok" });
      console.log(JSON.stringify({ event: "meta_sync_ok", lojaId, metaProductId: m.metaProductId }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      detalhes.push({ metaProductId: m.metaProductId, produtoId: m.produtoId, status: "error", error: msg });
      erros++;
      console.log(JSON.stringify({ event: "meta_sync_exception", lojaId, metaProductId: m.metaProductId, error: msg }));
    }
  }

  console.log(JSON.stringify({ event: "meta_sync_complete", lojaId, sincronizados, erros, total: mappings.length }));
  return { sincronizados, erros, detalhes };
}
