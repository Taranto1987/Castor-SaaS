import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { ilike, or, eq, and, isNull, gt } from "drizzle-orm";

const router: IRouter = Router();

function mapProduto(p: typeof produtosTable.$inferSelect) {
  return {
    id: p.id,
    nome: p.nome,
    sku: p.sku,
    preco: p.preco,
    precoPix: p.precoPix,
    parcelamento: p.parcelamento,
    medidas: p.medidas,
    altura: p.altura,
    categoria: p.categoria,
    imagem: p.imagem,
    link: p.link,
    disponivel: p.disponivel,
    encomenda: p.encomenda,
    custoBRL: p.custoBRL,
    prazoEncomenda: p.prazoEncomenda,
    estoque: p.estoque,
    criadoEm: p.criadoEm,
  };
}

router.get("/", async (req, res) => {
  try {
    const { categoria, limite, interno } = req.query;
    const categoriaCond = categoria ? eq(produtosTable.categoria, categoria as string) : undefined;
    const stockCond = interno !== "1" ? or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0)) : undefined;
    const whereCond = categoriaCond && stockCond ? and(categoriaCond, stockCond)
      : categoriaCond ?? stockCond;
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

router.get("/outlet", async (_req, res) => {
  try {
    const results = await db
      .select()
      .from(produtosTable)
      .where(eq(produtosTable.encomenda, true))
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
    const custoNum = parseFloat(String(custoBRL || "0")) || 0;
    const precoVenda = custoNum > 0 ? Math.ceil(custoNum * 1.6) : undefined;
    const inserted = await db.insert(produtosTable).values({
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

router.get("/categorias", async (_req, res) => {
  try {
    const results = await db.selectDistinct({ categoria: produtosTable.categoria }).from(produtosTable);
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

    const stockCond = or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0));
    const allConds = [
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

router.get("/estoque", async (_req, res) => {
  try {
    const results = await db
      .select()
      .from(produtosTable)
      .where(eq(produtosTable.encomenda, false))
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
