import { db } from "@workspace/db";
import { produtosTable, outletInteressesTable } from "@workspace/db/schema";
import { ilike, or, eq, and, isNull, gt, desc, count, max, inArray, sql, type SQL } from "drizzle-orm";
import { deduplicateBySku, mapProduto, mapProdutoPublic } from "./mappers";
import { getLojaPricing, calcOutletPrice } from "./pricing";
import type { MappedProduto, MappedProdutoPublic } from "./types";

// ── List / Query ────────────────────────────────────────────────────────────────

export async function listProdutos(
  lojaId: number,
  opts: { categoria?: string; limite?: number; interno?: boolean },
): Promise<MappedProduto[]> {
  const conds: SQL[] = [eq(produtosTable.lojaId, lojaId)];
  if (opts.categoria) conds.push(eq(produtosTable.categoria, opts.categoria));
  if (!opts.interno) conds.push(or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0))!);

  const results = await db.select().from(produtosTable)
    .where(and(...conds))
    .limit(opts.limite ?? 100);
  return deduplicateBySku(results).map(mapProduto);
}

export async function listOutlet(
  lojaId: number,
  limite?: number,
): Promise<MappedProdutoPublic[]> {
  const results = await db.select().from(produtosTable)
    .where(and(
      eq(produtosTable.encomenda, true),
      eq(produtosTable.lojaId, lojaId),
      or(isNull(produtosTable.disponivel), eq(produtosTable.disponivel, true)),
      or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0)),
    ))
    .orderBy(produtosTable.nome)
    .limit(limite ?? 1000);
  return deduplicateBySku(results).map(mapProdutoPublic);
}

export async function listEstoque(lojaId: number): Promise<MappedProduto[]> {
  const results = await db.select().from(produtosTable)
    .where(and(eq(produtosTable.encomenda, false), eq(produtosTable.lojaId, lojaId)))
    .orderBy(produtosTable.nome);
  return deduplicateBySku(results).map(mapProduto);
}

export async function listCategorias(lojaId: number): Promise<string[]> {
  const results = await db.selectDistinct({ categoria: produtosTable.categoria })
    .from(produtosTable)
    .where(eq(produtosTable.lojaId, lojaId));
  return results.map(r => r.categoria).filter(Boolean);
}

export async function listGestao(
  lojaId: number,
  opts: { busca?: string; categoria?: string },
) {
  const conds: SQL[] = [
    eq(produtosTable.disponivel, true),
    eq(produtosTable.lojaId, lojaId),
  ];
  if (opts.categoria && opts.categoria !== "todos") conds.push(eq(produtosTable.categoria, opts.categoria));
  if (opts.busca) conds.push(ilike(produtosTable.nome, `%${opts.busca}%`));

  const rows = await db.select({
    id: produtosTable.id,
    nome: produtosTable.nome,
    sku: produtosTable.sku,
    categoria: produtosTable.categoria,
    medidas: produtosTable.medidas,
    size: produtosTable.size,
    familyName: produtosTable.familyName,
    encomenda: produtosTable.encomenda,
    prazoEncomenda: produtosTable.prazoEncomenda,
  }).from(produtosTable)
    .where(and(...conds))
    .orderBy(produtosTable.categoria, produtosTable.nome)
    .limit(600);

  return deduplicateBySku(rows);
}

export async function searchProdutos(
  lojaId: number,
  q: string,
  categoria?: string,
): Promise<MappedProduto[]> {
  const termos = q.trim().split(/\s+/);
  const textoConds = termos.map(t =>
    or(
      ilike(produtosTable.nome, `%${t}%`),
      ilike(produtosTable.sku, `%${t}%`),
      ilike(produtosTable.medidas, `%${t}%`),
    ),
  );

  const categoriaCond = categoria ? eq(produtosTable.categoria, categoria) : undefined;
  const stockCond = or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0));
  const allConds = [
    eq(produtosTable.lojaId, lojaId),
    ...(textoConds.length === 1 ? [textoConds[0]] : [and(...textoConds)]),
    ...(categoriaCond ? [categoriaCond] : []),
    stockCond,
  ].filter(Boolean) as SQL[];

  const results = allConds.length === 1
    ? await db.select().from(produtosTable).where(allConds[0]).limit(80)
    : await db.select().from(produtosTable).where(and(...allConds)).limit(80);

  return results.map(mapProduto);
}

export async function findById(id: number): Promise<MappedProduto | null> {
  const results = await db.select().from(produtosTable).where(eq(produtosTable.id, id)).limit(1);
  return results.length > 0 ? mapProduto(results[0]) : null;
}

export async function findBySlug(lojaId: number, slug: string): Promise<MappedProduto | null> {
  let results = await db.select().from(produtosTable)
    .where(and(eq(produtosTable.lojaId, lojaId), eq(produtosTable.slug, slug)))
    .limit(1);

  if (results.length === 0) {
    const legacyLink = `https://lojacastor.com.br/${slug}`;
    results = await db.select().from(produtosTable)
      .where(and(
        eq(produtosTable.lojaId, lojaId),
        isNull(produtosTable.slug),
        eq(produtosTable.link, legacyLink),
      ))
      .limit(1);
  }

  return results.length > 0 ? mapProduto(results[0]) : null;
}

export async function findRelated(
  lojaId: number,
  familySlug: string,
  excludeId?: number,
): Promise<MappedProdutoPublic[]> {
  const siblings = await db.select().from(produtosTable)
    .where(and(
      eq(produtosTable.familySlug, familySlug),
      eq(produtosTable.lojaId, lojaId),
      eq(produtosTable.disponivel, true),
    ))
    .limit(8);

  const filtered = excludeId ? siblings.filter(p => p.id !== excludeId) : siblings;
  return deduplicateBySku(filtered).map(mapProdutoPublic);
}

// ── Mutations ───────────────────────────────────────────────────────────────────

export async function createOutletProduto(
  lojaId: number,
  data: { nome: string; categoria: string; medidas?: string; custoBRL?: string; prazoEncomenda?: string },
): Promise<MappedProduto> {
  const custoNum = parseFloat(String(data.custoBRL || "0")) || 0;
  const precoVenda = custoNum > 0 ? Math.ceil(custoNum * 1.6) : undefined;
  const inserted = await db.insert(produtosTable).values({
    lojaId,
    nome: data.nome,
    categoria: data.categoria,
    medidas: data.medidas ?? null,
    custoBRL: data.custoBRL ? String(data.custoBRL) : null,
    prazoEncomenda: data.prazoEncomenda ?? "A combinar",
    precoPix: precoVenda ? precoVenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null,
    encomenda: true,
    disponivel: true,
  }).returning();
  return mapProduto(inserted[0]);
}

export async function updateEncomenda(
  id: number,
  lojaId: number,
  encomenda: boolean,
  opts?: { outletMarkupPercent?: number; prazoEncomenda?: string },
): Promise<MappedProduto | null> {
  let pricingFields: Record<string, string> = {};

  if (encomenda) {
    const [produto] = await db.select({ precoBase: produtosTable.precoBase })
      .from(produtosTable).where(eq(produtosTable.id, id)).limit(1);
    const tablePrice = produto?.precoBase ? parseFloat(String(produto.precoBase)) : 0;

    if (tablePrice > 0) {
      const lojaPricing = await getLojaPricing(lojaId);
      const markup = opts?.outletMarkupPercent ?? lojaPricing.outletMarkupPercent;
      const { factoryCost, outletPrice } = calcOutletPrice(tablePrice, {
        supplierDiscountPercent: lojaPricing.supplierDiscountPercent,
        outletMarkupPercent: markup,
      });
      pricingFields = {
        factoryCost: String(factoryCost),
        outletMarkupPercent: String(markup),
        outletPrice: String(outletPrice),
      };
    }
  }

  const updated = await db.update(produtosTable)
    .set({
      encomenda,
      ...pricingFields,
      ...(opts?.prazoEncomenda !== undefined ? { prazoEncomenda: opts.prazoEncomenda } : {}),
    })
    .where(eq(produtosTable.id, id))
    .returning();

  return updated.length > 0 ? mapProduto(updated[0]) : null;
}

export async function updateDisponibilidade(
  id: number,
  lojaId: number,
  disponivel: boolean,
): Promise<MappedProduto | null> {
  const updated = await db.update(produtosTable)
    .set({ disponivel })
    .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId)))
    .returning();
  return updated.length > 0 ? mapProduto(updated[0]) : null;
}

export async function updateEstoque(
  id: number,
  lojaId: number,
  estoque: number,
): Promise<MappedProduto | null> {
  const updated = await db.update(produtosTable)
    .set({ estoque, disponivel: estoque > 0 })
    .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId)))
    .returning();
  return updated.length > 0 ? mapProduto(updated[0]) : null;
}

export async function registerOutletInteresse(
  produtoId: number,
  lojaId: number,
): Promise<{ ok: boolean; error?: string }> {
  const [produto] = await db.select().from(produtosTable).where(eq(produtosTable.id, produtoId)).limit(1);
  if (!produto || !produto.encomenda) return { ok: false, error: "Produto outlet não encontrado" };
  await db.insert(outletInteressesTable).values({ produtoId, lojaId });
  return { ok: true };
}

export async function outletRanking(lojaId: number) {
  const ranking = await db
    .select({
      produtoId: outletInteressesTable.produtoId,
      total: count(outletInteressesTable.id),
      ultimoInteresse: max(outletInteressesTable.criadoEm),
    })
    .from(outletInteressesTable)
    .groupBy(outletInteressesTable.produtoId)
    .orderBy(desc(count(outletInteressesTable.id)));

  const produtoIds = ranking.map(r => r.produtoId);
  if (produtoIds.length === 0) return [];

  const produtos = await db.select().from(produtosTable)
    .where(and(inArray(produtosTable.id, produtoIds), eq(produtosTable.lojaId, lojaId)));
  const produtoMap = new Map(produtos.map(p => [p.id, p]));

  return ranking
    .map(r => {
      const p = produtoMap.get(r.produtoId);
      if (!p) return null;
      return { ...mapProduto(p), totalInteresses: Number(r.total), ultimoInteresse: r.ultimoInteresse };
    })
    .filter(Boolean);
}

export async function promoverOutlet(
  id: number,
  lojaId: number,
  estoque: number,
  precoPix?: string,
): Promise<MappedProduto | null> {
  const [produto] = await db.select().from(produtosTable)
    .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId))).limit(1);
  if (!produto) return null;
  if (!produto.encomenda) throw new Error("Produto já está no catálogo regular");

  const setData: { encomenda: boolean; estoque: number; disponivel: boolean; precoPix?: string } = {
    encomenda: false, estoque, disponivel: true,
  };
  if (precoPix && typeof precoPix === "string" && /^R\$\s?\d/.test(precoPix)) {
    setData.precoPix = precoPix;
  }

  const updated = await db.update(produtosTable)
    .set(setData)
    .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId)))
    .returning();
  return mapProduto(updated[0]);
}

export async function bulkToggleEncomenda(
  ids: number[],
  encomenda: boolean,
  lojaId: number,
  markupOverride?: number,
): Promise<number> {
  if (encomenda) {
    const lojaPricing = await getLojaPricing(lojaId);
    const markup = markupOverride ?? lojaPricing.outletMarkupPercent;
    const produtos = await db
      .select({ id: produtosTable.id, precoBase: produtosTable.precoBase })
      .from(produtosTable)
      .where(inArray(produtosTable.id, ids));

    for (const p of produtos) {
      const tablePrice = p.precoBase ? parseFloat(String(p.precoBase)) : 0;
      const { factoryCost, outletPrice } = tablePrice > 0
        ? calcOutletPrice(tablePrice, { supplierDiscountPercent: lojaPricing.supplierDiscountPercent, outletMarkupPercent: markup })
        : { factoryCost: 0, outletPrice: 0 };

      await db.update(produtosTable).set({
        encomenda: true,
        outletMarkupPercent: String(markup),
        ...(tablePrice > 0 ? { factoryCost: String(factoryCost), outletPrice: String(outletPrice) } : {}),
      }).where(eq(produtosTable.id, p.id));
    }
  } else {
    await db.update(produtosTable).set({ encomenda: false }).where(inArray(produtosTable.id, ids));
  }
  return ids.length;
}

export async function cleanupDuplicates(lojaId: number): Promise<number[]> {
  const result: number[] = await db.execute(sql`
    DELETE FROM produtos
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY sku, loja_id ORDER BY id) AS rn
        FROM produtos
        WHERE sku IS NOT NULL AND loja_id = ${lojaId}
      ) ranked
      WHERE rn > 1
    )
    RETURNING id
  `).then((rows: any) => (Array.isArray(rows) ? rows : rows.rows ?? []).map((r: any) => r.id));

  console.log(`[Cleanup] Removed ${result.length} duplicate products for loja ${lojaId}`);
  return result;
}
