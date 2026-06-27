import { Router, type IRouter } from "express";
import { db, metaCatalogoConfigTable, metaProdutosTable, produtosTable, lojasTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireDono, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

function escCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// --- Public: CSV feed for Meta Commerce Manager ---
// GET /api/meta-catalog/feed/:lojaSlug
router.get("/meta-catalog/feed/:lojaSlug", async (req, res) => {
  try {
    const { lojaSlug } = req.params;

    const [loja] = await db.select({ id: lojasTable.id })
      .from(lojasTable)
      .where(and(eq(lojasTable.slug, lojaSlug), eq(lojasTable.ativa, true)));

    if (!loja) {
      res.status(404).send("Feed not found");
      return;
    }

    const [config] = await db.select()
      .from(metaCatalogoConfigTable)
      .where(and(eq(metaCatalogoConfigTable.lojaId, loja.id), eq(metaCatalogoConfigTable.ativo, true)));

    if (!config) {
      res.status(404).send("Feed not configured");
      return;
    }

    const mappings = await db.select({
      metaProductId: metaProdutosTable.metaProductId,
      retailerId: metaProdutosTable.retailerId,
      produtoId: metaProdutosTable.produtoId,
    })
      .from(metaProdutosTable)
      .where(and(eq(metaProdutosTable.lojaId, loja.id), eq(metaProdutosTable.ativo, true)));

    if (mappings.length === 0) {
      res.status(404).send("No products mapped");
      return;
    }

    const productIds = mappings.map(m => m.produtoId);
    const products = await db.select()
      .from(produtosTable)
      .where(and(
        eq(produtosTable.lojaId, loja.id),
        eq(produtosTable.disponivel, true),
      ));

    const productMap = new Map(products.map(p => [p.id, p]));

    const header = "id,title,description,availability,condition,price,link,image_link,brand";
    const rows: string[] = [header];

    for (const m of mappings) {
      const p = productMap.get(m.produtoId);
      if (!p) continue;

      const retailerId = m.retailerId || String(p.id);
      const title = p.nome;
      const description = p.descricao
        ? p.descricao.replace(/<[^>]*>/g, "").substring(0, 5000)
        : p.nome;
      const availability = p.disponivel ? "in stock" : "out of stock";
      const condition = "new";

      let priceNum = p.precoBase ? parseFloat(p.precoBase) : null;
      if (!priceNum && p.preco) {
        const parsed = p.preco.replace(/[^\d,.]/g, "").replace(",", ".");
        priceNum = parseFloat(parsed) || null;
      }
      const price = priceNum ? `${priceNum.toFixed(2)} BRL` : "";

      const link = p.link || `https://lojacastor.com.br/${p.slug || ""}`;
      const imageLink = p.imagem || "";

      rows.push([
        escCsv(retailerId),
        escCsv(title),
        escCsv(description),
        escCsv(availability),
        escCsv(condition),
        escCsv(price),
        escCsv(link),
        escCsv(imageLink),
        escCsv("Castor"),
      ].join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="meta-feed-${lojaSlug}.csv"`);
    res.setHeader("Cache-Control", "public, max-age=900");
    res.send(rows.join("\n"));
  } catch (err) {
    console.error("[meta-catalog] feed error:", err);
    res.status(500).send("Internal server error");
  }
});

// --- Protected: Management routes (dono only) ---

// GET /api/meta-catalog/config
router.get("/meta-catalog/config", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const [config] = await db.select({
      id: metaCatalogoConfigTable.id,
      catalogId: metaCatalogoConfigTable.catalogId,
      feedId: metaCatalogoConfigTable.feedId,
      ativo: metaCatalogoConfigTable.ativo,
      criadoEm: metaCatalogoConfigTable.criadoEm,
      atualizadoEm: metaCatalogoConfigTable.atualizadoEm,
    })
      .from(metaCatalogoConfigTable)
      .where(eq(metaCatalogoConfigTable.lojaId, lojaId));

    res.json(config ?? null);
  } catch (err) {
    console.error("[meta-catalog] config get error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/meta-catalog/config
router.post("/meta-catalog/config", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { catalogId, feedId, accessToken } = req.body as {
      catalogId?: string;
      feedId?: string;
      accessToken?: string;
    };

    if (!catalogId || !accessToken) {
      res.status(400).json({ error: "catalogId e accessToken são obrigatórios" });
      return;
    }

    const [existing] = await db.select({ id: metaCatalogoConfigTable.id })
      .from(metaCatalogoConfigTable)
      .where(eq(metaCatalogoConfigTable.lojaId, lojaId));

    if (existing) {
      await db.update(metaCatalogoConfigTable)
        .set({ catalogId, feedId: feedId ?? null, accessToken, atualizadoEm: new Date() })
        .where(eq(metaCatalogoConfigTable.id, existing.id));
    } else {
      await db.insert(metaCatalogoConfigTable).values({
        lojaId, catalogId, feedId: feedId ?? null, accessToken,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[meta-catalog] config save error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/meta-catalog/produtos
router.get("/meta-catalog/produtos", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const rows = await db.select({
      id: metaProdutosTable.id,
      metaProductId: metaProdutosTable.metaProductId,
      retailerId: metaProdutosTable.retailerId,
      produtoId: metaProdutosTable.produtoId,
      ativo: metaProdutosTable.ativo,
    })
      .from(metaProdutosTable)
      .where(eq(metaProdutosTable.lojaId, lojaId));

    res.json(rows);
  } catch (err) {
    console.error("[meta-catalog] produtos list error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/meta-catalog/produtos
router.post("/meta-catalog/produtos", requireDono, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { produtos } = req.body as {
      produtos: Array<{
        metaProductId: string;
        retailerId?: string;
        produtoId: number;
      }>;
    };

    if (!Array.isArray(produtos) || produtos.length === 0) {
      res.status(400).json({ error: "Array 'produtos' é obrigatório" });
      return;
    }

    let inserted = 0;
    for (const p of produtos) {
      if (!p.metaProductId || !p.produtoId) continue;

      const [existing] = await db.select({ id: metaProdutosTable.id })
        .from(metaProdutosTable)
        .where(and(
          eq(metaProdutosTable.metaProductId, p.metaProductId),
          eq(metaProdutosTable.lojaId, lojaId),
        ));

      if (existing) {
        await db.update(metaProdutosTable)
          .set({ produtoId: p.produtoId, retailerId: p.retailerId ?? null, ativo: true })
          .where(eq(metaProdutosTable.id, existing.id));
      } else {
        await db.insert(metaProdutosTable).values({
          lojaId,
          metaProductId: p.metaProductId,
          retailerId: p.retailerId ?? null,
          produtoId: p.produtoId,
        });
      }
      inserted++;
    }

    res.json({ ok: true, total: inserted });
  } catch (err) {
    console.error("[meta-catalog] produtos save error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
