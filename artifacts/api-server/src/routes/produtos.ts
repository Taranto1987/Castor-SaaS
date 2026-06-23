import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, extractFamilyInfo } from "@workspace/db";
import { produtosTable, outletInteressesTable, lojasTable } from "@workspace/db/schema";
import { ilike, or, eq, and, isNull, gt, desc, count, max, inArray, sql, type SQL } from "drizzle-orm";
import { getSession, isDono as isDonoSession } from "../lib/sessions";
import { resolveLojaId } from "../middlewares/auth";
import { getPricingConfig, calcOutletPrice, DEFAULT_PRICING } from "./loja";

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Sessão não encontrada" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  if (!isDonoSession(session)) { res.status(403).json({ error: "Acesso restrito ao dono" }); return; }
  next();
}

const router: IRouter = Router();

function deduplicateBySku<T extends { id: number; sku?: string | null }>(rows: T[]): T[] {
  const seen = new Map<string, number>();
  return rows.filter(r => {
    if (!r.sku) return true;
    const existing = seen.get(r.sku);
    if (existing !== undefined) return false;
    seen.set(r.sku, r.id);
    return true;
  });
}

function extractGallery(p: typeof produtosTable.$inferSelect): Array<{url: string; label: string | null}> {
  const ft = p.fichaTecnica as Record<string, unknown> | null;
  const raw = ft?._raw as Record<string, unknown> | undefined;
  const gallery = raw?.media_gallery as Array<{url: string; label: string | null}> | undefined;
  if (Array.isArray(gallery) && gallery.length > 0) return gallery;
  if (p.imagem) return [{ url: p.imagem, label: p.nome }];
  return [];
}

function mapProduto(p: typeof produtosTable.$inferSelect) {
  // Prefer DB-stored values (written by crawler); fall back to runtime extraction
  // for products that pre-date the family columns or were added via outlet/manual entry.
  const family = (p.familySlug && p.familyName)
    ? { familySlug: p.familySlug, familyName: p.familyName, size: p.size }
    : extractFamilyInfo(p.slug, p.nome);
  return {
    id: p.id,
    nome: p.nome,
    sku: p.sku,
    slug: p.slug,
    preco: p.preco,
    precoPix: p.precoPix,
    parcelamento: p.parcelamento,
    medidas: p.medidas,
    altura: p.altura,
    categoria: p.categoria,
    imagem: p.imagem,
    disponivel: p.disponivel,
    encomenda: p.encomenda,
    custoBRL: p.custoBRL,
    prazoEncomenda: p.prazoEncomenda,
    estoque: p.estoque,
    precoBase: p.precoBase ? parseFloat(String(p.precoBase)) : null,
    factoryCost: p.factoryCost ? parseFloat(String(p.factoryCost)) : null,
    outletMarkupPercent: p.outletMarkupPercent ? parseFloat(String(p.outletMarkupPercent)) : null,
    outletPrice: p.outletPrice ? parseFloat(String(p.outletPrice)) : null,
    familySlug: family.familySlug,
    familyName: family.familyName,
    size: family.size,
    descricao: p.descricao,
    fichaTecnica: p.fichaTecnica,
    imagens: extractGallery(p),
    criadoEm: p.criadoEm,
  };
}

// Public-safe mapper: strips internal cost/margin fields; keeps outletPrice (the selling price).
function mapProdutoPublic(p: typeof produtosTable.$inferSelect) {
  const { custoBRL: _c, precoBase: _pb, factoryCost: _fc, outletMarkupPercent: _om, ...pub } = mapProduto(p);
  return pub;
}

async function getLojaPricing(lojaId: number) {
  const rows = await db
    .select({ configJson: lojasTable.configJson })
    .from(lojasTable)
    .where(eq(lojasTable.id, lojaId))
    .limit(1);
  return getPricingConfig(rows[0]?.configJson);
}

router.get("/", async (req, res) => {
  try {
    const { categoria, limite, interno } = req.query;
    const lojaId = resolveLojaId(req);
    const lojaCond = eq(produtosTable.lojaId, lojaId);
    const categoriaCond = categoria ? eq(produtosTable.categoria, categoria as string) : undefined;
    const stockCond = interno !== "1" ? or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0)) : undefined;
    const conds = [lojaCond, categoriaCond, stockCond].filter(Boolean) as SQL[];
    const whereCond = and(...conds);
    const results = await db
      .select()
      .from(produtosTable)
      .where(whereCond)
      .limit(limite ? parseInt(limite as string) : 100);
    res.json(deduplicateBySku(results).map(mapProduto));
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/outlet", async (req, res) => {
  try {
    // Restrict ?lojaId= to known tenant IDs — prevents cross-tenant enumeration.
    const VALID_LOJA_IDS = [1, 2];
    const queryLojaId = req.query.lojaId ? parseInt(req.query.lojaId as string, 10) : null;
    const lojaId = (queryLojaId && !isNaN(queryLojaId) && VALID_LOJA_IDS.includes(queryLojaId))
      ? queryLojaId
      : resolveLojaId(req);
    const limite = req.query.limite ? parseInt(req.query.limite as string, 10) : undefined;
    const results = await db
      .select()
      .from(produtosTable)
      .where(and(
        eq(produtosTable.encomenda, true),
        eq(produtosTable.lojaId, lojaId),
        or(isNull(produtosTable.disponivel), eq(produtosTable.disponivel, true)),
        or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0))
      ))
      .orderBy(produtosTable.nome)
      .limit(limite && !isNaN(limite) ? limite : 1000);
    res.json(deduplicateBySku(results).map(mapProdutoPublic));
  } catch (error) {
    console.error("Erro ao listar outlet:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/outlet", async (req, res) => {
  try {
    const { nome, categoria, medidas, custoBRL, prazoEncomenda } = req.body;
    if (!nome || !categoria) {
      res.status(400).json({ error: "Nome e categoria são obrigatórios" });
      return;
    }
    const lojaId = resolveLojaId(req);
    const custoNum = parseFloat(String(custoBRL || "0")) || 0;
    const precoVenda = custoNum > 0 ? Math.ceil(custoNum * 1.6) : undefined;
    const inserted = await db.insert(produtosTable).values({
      lojaId,
      nome,
      categoria,
      medidas: medidas ?? null,
      custoBRL: custoBRL ? String(custoBRL) : null,
      prazoEncomenda: prazoEncomenda ?? "A combinar",
      precoPix: precoVenda ? precoVenda.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null,
      encomenda: true,
      disponivel: true,
    }).returning();
    res.json(mapProduto(inserted[0]));
  } catch (error) {
    console.error("Erro ao criar produto outlet:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/encomenda", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { encomenda, outletMarkupPercent: markupOverride, prazoEncomenda } = req.body as {
      encomenda: boolean;
      outletMarkupPercent?: number;
      prazoEncomenda?: string;
    };
    if (typeof encomenda !== "boolean") {
      res.status(400).json({ error: "Campo encomenda (boolean) obrigatório" });
      return;
    }

    const token = (req.headers["x-session-token"] ?? "") as string;
    const session = getSession(token);
    const lojaId = session?.lojaId ?? 1;

    let pricingFields: Partial<typeof produtosTable.$inferInsert> = {};

    if (encomenda) {
      // Moving to outlet: auto-calculate pricing from precoBase
      const [produto] = await db.select({ precoBase: produtosTable.precoBase }).from(produtosTable).where(eq(produtosTable.id, id)).limit(1);
      const tablePrice = produto?.precoBase ? parseFloat(String(produto.precoBase)) : 0;

      if (tablePrice > 0) {
        const lojaPricing = await getLojaPricing(lojaId);
        const markup = markupOverride ?? lojaPricing.outletMarkupPercent;
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
        ...(prazoEncomenda !== undefined ? { prazoEncomenda } : {}),
      })
      .where(eq(produtosTable.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }
    res.json(mapProduto(updated[0]));
  } catch (error) {
    console.error("Erro ao atualizar encomenda:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/categorias", async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
    const results = await db.selectDistinct({ categoria: produtosTable.categoria })
      .from(produtosTable)
      .where(eq(produtosTable.lojaId, lojaId));
    res.json(results.map(r => r.categoria).filter(Boolean));
  } catch (error) {
    console.error("Erro ao listar categorias:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/buscar", async (req, res) => {
  try {
    const { q, categoria } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Parâmetro q obrigatório" });
      return;
    }

    const { and } = await import("drizzle-orm");
    const termos = q.trim().split(/\s+/);
    const textoConds = termos.map(t =>
      or(
        ilike(produtosTable.nome, `%${t}%`),
        ilike(produtosTable.sku, `%${t}%`),
        ilike(produtosTable.medidas, `%${t}%`)
      )
    );

    const categoriaCond = categoria && typeof categoria === "string"
      ? eq(produtosTable.categoria, categoria)
      : undefined;

    const lojaId = resolveLojaId(req);
    const stockCond = or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0));
    const allConds = [
      eq(produtosTable.lojaId, lojaId),
      ...(textoConds.length === 1 ? [textoConds[0]] : [and(...textoConds)]),
      ...(categoriaCond ? [categoriaCond] : []),
      stockCond,
    ].filter(Boolean);

    let results;
    if (allConds.length === 1) {
      results = await db.select().from(produtosTable).where(allConds[0]).limit(80);
    } else {
      results = await db.select().from(produtosTable).where(and(...allConds)).limit(80);
    }

    res.json(results.map(mapProduto));
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/disponibilidade", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { disponivel } = req.body;
    if (typeof disponivel !== "boolean") {
      res.status(400).json({ error: "Campo disponivel (boolean) obrigatório" });
      return;
    }
    const lojaId = resolveLojaId(req);
    const updated = await db.update(produtosTable)
      .set({ disponivel })
      .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId)))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }
    res.json(mapProduto(updated[0]));
  } catch (error) {
    console.error("Erro ao atualizar disponibilidade:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/outlet/:id/interesse", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const [produto] = await db.select().from(produtosTable).where(eq(produtosTable.id, id)).limit(1);
    if (!produto || !produto.encomenda) {
      res.status(404).json({ error: "Produto outlet não encontrado" });
      return;
    }
    const lojaId = resolveLojaId(req);
    await db.insert(outletInteressesTable).values({ produtoId: id, lojaId });
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao registrar interesse:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/outlet/ranking", requireDono, async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
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
    if (produtoIds.length === 0) {
      res.json([]);
      return;
    }

    const produtos = await db.select().from(produtosTable)
      .where(and(inArray(produtosTable.id, produtoIds), eq(produtosTable.lojaId, lojaId)));
    const produtoMap = new Map(produtos.map(p => [p.id, p]));

    const result = ranking
      .map(r => {
        const p = produtoMap.get(r.produtoId);
        if (!p) return null;
        return {
          ...mapProduto(p),
          totalInteresses: Number(r.total),
          ultimoInteresse: r.ultimoInteresse,
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar ranking outlet:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/outlet/:id/promover", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const lojaId = resolveLojaId(req);
    const [produto] = await db.select().from(produtosTable)
      .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId))).limit(1);
    if (!produto) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }
    if (!produto.encomenda) {
      res.status(400).json({ error: "Produto já está no catálogo regular (não é encomenda)" });
      return;
    }
    const { estoque, precoPix } = req.body;
    if (typeof estoque !== "number" || !Number.isInteger(estoque) || estoque < 1) {
      res.status(400).json({ error: "Campo estoque (inteiro >= 1) obrigatório" });
      return;
    }
    const setData: { encomenda: boolean; estoque: number; disponivel: boolean; precoPix?: string } = {
      encomenda: false,
      estoque,
      disponivel: true,
    };
    if (precoPix && typeof precoPix === "string" && /^R\$\s?\d/.test(precoPix)) {
      setData.precoPix = precoPix;
    }
    const updated = await db.update(produtosTable)
      .set(setData)
      .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId)))
      .returning();
    res.json(mapProduto(updated[0]));
  } catch (error) {
    console.error("Erro ao promover produto:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/estoque", async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
    const results = await db
      .select()
      .from(produtosTable)
      .where(and(eq(produtosTable.encomenda, false), eq(produtosTable.lojaId, lojaId)))
      .orderBy(produtosTable.nome);
    res.json(deduplicateBySku(results).map(mapProduto));
  } catch (error) {
    console.error("Erro ao listar estoque:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/estoque", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { estoque } = req.body;
    if (typeof estoque !== "number" || !Number.isInteger(estoque) || estoque < 0) {
      res.status(400).json({ error: "Campo estoque (inteiro >= 0) obrigatório" });
      return;
    }
    const lojaId = resolveLojaId(req);
    const updated = await db.update(produtosTable)
      .set({ estoque, disponivel: estoque > 0 })
      .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId)))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }
    res.json(mapProduto(updated[0]));
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Dono-only: all products with encomenda status for catalog management UI.
router.get("/gestao", requireDono, async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
    const busca = req.query.busca as string | undefined;
    const categoria = req.query.categoria as string | undefined;

    const conds: SQL[] = [
      eq(produtosTable.disponivel, true),
      eq(produtosTable.lojaId, lojaId),
    ];
    if (categoria && categoria !== "todos") conds.push(eq(produtosTable.categoria, categoria));
    if (busca) conds.push(ilike(produtosTable.nome, `%${busca}%`));

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

    res.json(deduplicateBySku(rows));
  } catch (error) {
    console.error("Erro ao listar gestao:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Dono-only: bulk-toggle encomenda for multiple product IDs.
router.patch("/gestao/bulk-encomenda", requireDono, async (req, res) => {
  try {
    const { ids, encomenda, outletMarkupPercent: markupOverride } = req.body as {
      ids: number[];
      encomenda: boolean;
      outletMarkupPercent?: number;
    };
    if (!Array.isArray(ids) || ids.length === 0 || typeof encomenda !== "boolean") {
      res.status(400).json({ error: "ids (array) e encomenda (boolean) são obrigatórios" });
      return;
    }

    const token = (req.headers["x-session-token"] ?? "") as string;
    const session = getSession(token);
    const lojaId = session?.lojaId ?? 1;

    if (encomenda) {
      // Calculate outlet pricing per product based on its precoBase
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
          ...(tablePrice > 0 ? {
            factoryCost: String(factoryCost),
            outletPrice: String(outletPrice),
          } : {}),
        }).where(eq(produtosTable.id, p.id));
      }
    } else {
      await db.update(produtosTable).set({ encomenda: false }).where(inArray(produtosTable.id, ids));
    }

    res.json({ updated: ids.length });
  } catch (error) {
    console.error("Erro ao bulk-encomenda:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/gestao/cleanup-duplicates", requireDono, async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
    const duplicateIds: number[] = await db.execute(sql`
      DELETE FROM produtos
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER (PARTITION BY sku, loja_id ORDER BY id) AS rn
          FROM produtos
          WHERE sku IS NOT NULL AND loja_id = ${lojaId}
        ) ranked
        WHERE rn > 1
      )
      RETURNING id
    `).then((rows: any) => (Array.isArray(rows) ? rows : rows.rows ?? []).map((r: any) => r.id));

    console.log(`[Cleanup] Removed ${duplicateIds.length} duplicate products for loja ${lojaId}`);
    res.json({ deleted: duplicateIds.length, ids: duplicateIds });
  } catch (error) {
    console.error("Erro ao limpar duplicatas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/related/:familySlug", async (req, res) => {
  try {
    const { familySlug } = req.params;
    const excludeId = req.query.exclude ? parseInt(req.query.exclude as string, 10) : undefined;
    const lojaId = resolveLojaId(req);

    const siblings = await db.select().from(produtosTable)
      .where(and(
        eq(produtosTable.familySlug, familySlug),
        eq(produtosTable.lojaId, lojaId),
        eq(produtosTable.disponivel, true),
      ))
      .limit(8);

    const filtered = excludeId
      ? siblings.filter(p => p.id !== excludeId)
      : siblings;

    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(deduplicateBySku(filtered).map(mapProdutoPublic));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// Public PDP endpoint — matches slug stored in DB, with exact-URL fallback for legacy
// products crawled before the slug column was added (slug IS NULL, link IS NOT NULL).
// lojaId is scoped per request so cross-tenant data never leaks.
router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) { res.status(400).json({ error: "Slug obrigatório" }); return; }

    const lojaId = resolveLojaId(req);

    // Primary: exact match on slug column
    let results = await db.select().from(produtosTable)
      .where(and(eq(produtosTable.lojaId, lojaId), eq(produtosTable.slug, slug)))
      .limit(1);

    // Fallback: legacy products whose slug was not yet backfilled — derive from link.
    // Uses exact prefix match (not ILIKE) to avoid false positives and full-table scans.
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

    if (results.length === 0) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(mapProduto(results[0]));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const results = await db.select().from(produtosTable).where(eq(produtosTable.id, id)).limit(1);
    if (results.length === 0) {
      res.status(404).json({ error: "Produto não encontrado" });
      return;
    }
    res.json(mapProduto(results[0]));
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
