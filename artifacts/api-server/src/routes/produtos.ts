import { Router, type IRouter } from "express";
import { getSession } from "../lib/sessions";
import { resolveLojaId, requireDono } from "../middlewares/auth";
import {
  listProdutos, listOutlet, listEstoque, listCategorias, listGestao,
  searchProdutos, findById, findBySlug, findRelated,
  createOutletProduto, updateEncomenda, updateDisponibilidade, updateEstoque,
  registerOutletInteresse, outletRanking, promoverOutlet,
  bulkToggleEncomenda, cleanupDuplicates,
} from "../services/produtos";

const router: IRouter = Router();

const VALID_LOJA_IDS = [1, 2];

router.get("/", async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
    const { categoria, categoriaInterna, limite, interno } = req.query;
    const result = await listProdutos(lojaId, {
      categoria: categoria as string | undefined,
      categoriaInterna: categoriaInterna as string | undefined,
      limite: limite ? parseInt(limite as string) : undefined,
      interno: interno === "1",
    });
    res.json(result);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/outlet", async (req, res) => {
  try {
    const queryLojaId = req.query.lojaId ? parseInt(req.query.lojaId as string, 10) : null;
    const lojaId = (queryLojaId && !isNaN(queryLojaId) && VALID_LOJA_IDS.includes(queryLojaId))
      ? queryLojaId
      : resolveLojaId(req);
    const limite = req.query.limite ? parseInt(req.query.limite as string, 10) : undefined;
    res.json(await listOutlet(lojaId, limite));
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
    res.json(await createOutletProduto(lojaId, { nome, categoria, medidas, custoBRL, prazoEncomenda }));
  } catch (error) {
    console.error("Erro ao criar produto outlet:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/encomenda", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { encomenda, outletMarkupPercent, prazoEncomenda } = req.body;
    if (typeof encomenda !== "boolean") {
      res.status(400).json({ error: "Campo encomenda (boolean) obrigatório" });
      return;
    }
    const session = getSession((req.headers["x-session-token"] ?? "") as string);
    const lojaId = session?.lojaId ?? 1;
    const result = await updateEncomenda(id, lojaId, encomenda, { outletMarkupPercent, prazoEncomenda });
    if (!result) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    res.json(result);
  } catch (error) {
    console.error("Erro ao atualizar encomenda:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/categorias", async (req, res) => {
  try {
    res.json(await listCategorias(resolveLojaId(req)));
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
    res.json(await searchProdutos(resolveLojaId(req), q, categoria as string | undefined));
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
    const result = await updateDisponibilidade(id, resolveLojaId(req), disponivel);
    if (!result) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    res.json(result);
  } catch (error) {
    console.error("Erro ao atualizar disponibilidade:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/outlet/:id/interesse", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const result = await registerOutletInteresse(id, resolveLojaId(req));
    if (!result.ok) { res.status(404).json({ error: result.error }); return; }
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao registrar interesse:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/outlet/ranking", requireDono, async (req, res) => {
  try {
    res.json(await outletRanking(resolveLojaId(req)));
  } catch (error) {
    console.error("Erro ao buscar ranking outlet:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/outlet/:id/promover", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { estoque, precoPix } = req.body;
    if (typeof estoque !== "number" || !Number.isInteger(estoque) || estoque < 1) {
      res.status(400).json({ error: "Campo estoque (inteiro >= 1) obrigatório" });
      return;
    }
    const result = await promoverOutlet(id, resolveLojaId(req), estoque, precoPix);
    if (!result) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("catálogo regular")) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Erro ao promover produto:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/estoque", async (req, res) => {
  try {
    res.json(await listEstoque(resolveLojaId(req)));
  } catch (error) {
    console.error("Erro ao listar estoque:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/estoque", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { estoque } = req.body;
    if (typeof estoque !== "number" || !Number.isInteger(estoque) || estoque < 0) {
      res.status(400).json({ error: "Campo estoque (inteiro >= 0) obrigatório" });
      return;
    }
    const result = await updateEstoque(id, resolveLojaId(req), estoque);
    if (!result) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    res.json(result);
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/gestao", requireDono, async (req, res) => {
  try {
    const lojaId = resolveLojaId(req);
    res.json(await listGestao(lojaId, {
      busca: req.query.busca as string | undefined,
      categoria: req.query.categoria as string | undefined,
    }));
  } catch (error) {
    console.error("Erro ao listar gestao:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/gestao/bulk-encomenda", requireDono, async (req, res) => {
  try {
    const { ids, encomenda, outletMarkupPercent } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || typeof encomenda !== "boolean") {
      res.status(400).json({ error: "ids (array) e encomenda (boolean) são obrigatórios" });
      return;
    }
    const session = getSession((req.headers["x-session-token"] ?? "") as string);
    const lojaId = session?.lojaId ?? 1;
    const updated = await bulkToggleEncomenda(ids, encomenda, lojaId, outletMarkupPercent);
    res.json({ updated });
  } catch (error) {
    console.error("Erro ao bulk-encomenda:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/gestao/cleanup-duplicates", requireDono, async (req, res) => {
  try {
    const ids = await cleanupDuplicates(resolveLojaId(req));
    res.json({ deleted: ids.length, ids });
  } catch (error) {
    console.error("Erro ao limpar duplicatas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/related/:familySlug", async (req, res) => {
  try {
    const excludeId = req.query.exclude ? parseInt(req.query.exclude as string, 10) : undefined;
    const result = await findRelated(resolveLojaId(req), req.params.familySlug, excludeId);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(result);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) { res.status(400).json({ error: "Slug obrigatório" }); return; }
    const result = await findBySlug(resolveLojaId(req), slug);
    if (!result) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(result);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const result = await findById(id);
    if (!result) { res.status(404).json({ error: "Produto não encontrado" }); return; }
    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
