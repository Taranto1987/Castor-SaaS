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
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Parâmetro q obrigatório" });
      return;
    }

    const termos = q.trim().split(/\s+/);
    const condicoes = termos.map(t =>
      or(
        ilike(produtosTable.nome, `%${t}%`),
        ilike(produtosTable.sku, `%${t}%`),
        ilike(produtosTable.medidas, `%${t}%`),
        ilike(produtosTable.categoria, `%${t}%`)
      )
    );

    let results;
    if (condicoes.length === 1) {
      results = await db.select().from(produtosTable).where(condicoes[0]).limit(50);
    } else {
      const { and } = await import("drizzle-orm");
      results = await db.select().from(produtosTable).where(and(...condicoes)).limit(50);
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
