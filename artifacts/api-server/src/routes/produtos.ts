import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { ilike, or, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { categoria, limite } = req.query;
    let query = db.select().from(produtosTable);

    const results = await db
      .select()
      .from(produtosTable)
      .where(categoria ? eq(produtosTable.categoria, categoria as string) : undefined)
      .limit(limite ? parseInt(limite as string) : 100);

    res.json(results.map(p => ({
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
      criadoEm: p.criadoEm,
    })));
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
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

    const allConds = [
      ...(textoConds.length === 1 ? [textoConds[0]] : [and(...textoConds)]),
      ...(categoriaCond ? [categoriaCond] : [])
    ].filter(Boolean);

    let results;
    if (allConds.length === 1) {
      results = await db.select().from(produtosTable).where(allConds[0]).limit(80);
    } else {
      results = await db.select().from(produtosTable).where(and(...allConds)).limit(80);
    }

    res.json(results.map(p => ({
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
      criadoEm: p.criadoEm,
    })));
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
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

    const p = results[0];
    res.json({
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
      criadoEm: p.criadoEm,
    });
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
