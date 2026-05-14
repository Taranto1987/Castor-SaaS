import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { produtosTable, outletInteressesTable } from "@workspace/db/schema";
import { ilike, or, eq, and, isNull, gt, desc, count, max, inArray, type SQL } from "drizzle-orm";
import { getSession, isDono as isDonoSession } from "../lib/sessions";
import { resolveLojaId } from "../middlewares/auth";

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Sessão não encontrada" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  if (!isDonoSession(session)) { res.status(403).json({ error: "Acesso restrito ao dono" }); return; }
  next();
}

const router: IRouter = Router();

function mapProduto(p: typeof produtosTable.$inferSelect) {
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
    criadoEm: p.criadoEm,
  };
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
    res.json(results.map(mapProduto));
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/outlet", async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
    const results = await db
      .select()
      .from(produtosTable)
      .where(and(eq(produtosTable.encomenda, true), eq(produtosTable.lojaId, lojaId)))
      .orderBy(produtosTable.nome);
    res.json(results.map(mapProduto));
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
    const { encomenda } = req.body;
    if (typeof encomenda !== "boolean") {
      res.status(400).json({ error: "Campo encomenda (boolean) obrigatório" });
      return;
    }
    const updated = await db.update(produtosTable)
      .set({ encomenda })
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

router.patch("/:id/disponibilidade", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { disponivel } = req.body;
    if (typeof disponivel !== "boolean") {
      res.status(400).json({ error: "Campo disponivel (boolean) obrigatório" });
      return;
    }
    const updated = await db.update(produtosTable)
      .set({ disponivel })
      .where(eq(produtosTable.id, id))
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
    await db.insert(outletInteressesTable).values({ produtoId: id });
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao registrar interesse:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/outlet/ranking", requireDono, async (_req, res) => {
  try {
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

    const produtos = await db.select().from(produtosTable).where(inArray(produtosTable.id, produtoIds));
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
    const [produto] = await db.select().from(produtosTable).where(eq(produtosTable.id, id)).limit(1);
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
      .where(eq(produtosTable.id, id))
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
    res.json(results.map(mapProduto));
  } catch (error) {
    console.error("Erro ao listar estoque:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/estoque", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { estoque } = req.body;
    if (typeof estoque !== "number" || !Number.isInteger(estoque) || estoque < 0) {
      res.status(400).json({ error: "Campo estoque (inteiro >= 0) obrigatório" });
      return;
    }
    const updated = await db.update(produtosTable)
      .set({ estoque, disponivel: estoque > 0 })
      .where(eq(produtosTable.id, id))
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

// Public PDP endpoint — matches slug stored in DB or derived from legacy link.
// Never exposes the upstream Castor URL; that stays in the DB only.
router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) { res.status(400).json({ error: "Slug obrigatório" }); return; }

    const results = await db.select().from(produtosTable)
      .where(eq(produtosTable.slug, slug)).limit(1);

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
