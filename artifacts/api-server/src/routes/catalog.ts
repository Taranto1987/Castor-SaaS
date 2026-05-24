import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { productFamiliesTable, produtosTable } from "@workspace/db/schema";
import { normalizeSize, SIZE_ORDER } from "@workspace/db";
import type { ProductSize } from "@workspace/db";
import { eq, and, inArray, asc } from "drizzle-orm";
import { getSession, isDono } from "../lib/sessions";

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CatalogVariant {
  size: ProductSize;
  produtoId: number | null;
  slug: string | null;
  preco: string | null;
  precoPix: string | null;
  parcelamento: string | null;
  medidas: string | null;
  altura: string | null;
  imagem: string | null;
  disponivel: boolean;
  encomenda: boolean;
  estoque: number | null;
}

export interface CatalogFamily {
  id: string;
  name: string;
  category: string;
  ranking: number;
  imageUrl: string | null;
  availableSizes: ProductSize[];
  variants: CatalogVariant[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derives catalog families directly from produtosTable when productFamiliesTable
 * is empty. This is the migration fallback — once the admin seeds Castor Core
 * families, this path is never taken.
 */
async function deriveFamiliesFromProdutos(lojaId: number): Promise<CatalogFamily[]> {
  const products = await db
    .select()
    .from(produtosTable)
    .where(and(eq(produtosTable.disponivel, true), eq(produtosTable.lojaId, lojaId)));

  const familyMap = new Map<string, { name: string; category: string; products: typeof products }>();
  const standalone: CatalogFamily[] = [];

  for (const p of products) {
    const size = normalizeSize(p.size);

    if (p.familySlug && size) {
      // Grouped: belongs to a size family
      const key = `${p.categoria}::${p.familySlug}`;
      if (!familyMap.has(key)) {
        familyMap.set(key, {
          name: p.familyName ?? p.nome,
          category: p.categoria,
          products: [],
        });
      }
      familyMap.get(key)!.products.push(p);
    } else {
      // Standalone: no family slug or unrecognised size
      const fallbackSize: ProductSize = size ?? "Casal";
      standalone.push({
        id: `single::${p.id}`,
        name: p.familyName ?? p.nome,
        category: p.categoria,
        ranking: 0,
        imageUrl: p.imagem ?? null,
        availableSizes: [fallbackSize],
        variants: [{
          size: fallbackSize,
          produtoId: p.id,
          slug: p.slug ?? null,
          preco: p.preco ?? null,
          precoPix: p.precoPix ?? null,
          parcelamento: p.parcelamento ?? null,
          medidas: p.medidas ?? null,
          altura: p.altura ?? null,
          imagem: p.imagem ?? null,
          disponivel: p.disponivel ?? true,
          encomenda: p.encomenda ?? false,
          estoque: p.estoque ?? null,
        }],
      });
    }
  }

  const grouped: CatalogFamily[] = [];
  for (const [, { name, category, products: fps }] of familyMap) {
    const variantMap = new Map<ProductSize, CatalogVariant>();
    for (const p of fps) {
      const size = normalizeSize(p.size);
      if (!size || variantMap.has(size)) continue;
      variantMap.set(size, {
        size,
        produtoId: p.id,
        slug: p.slug ?? null,
        preco: p.preco ?? null,
        precoPix: p.precoPix ?? null,
        parcelamento: p.parcelamento ?? null,
        medidas: p.medidas ?? null,
        altura: p.altura ?? null,
        imagem: p.imagem ?? null,
        disponivel: p.disponivel ?? true,
        encomenda: p.encomenda ?? false,
        estoque: p.estoque ?? null,
      });
    }
    const variants = [...variantMap.values()].sort(
      (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)
    );
    if (variants.length === 0) continue;
    const key = `${category}::${fps[0]?.familySlug}`;
    grouped.push({
      id: fps[0]?.familySlug ?? key,
      name,
      category,
      ranking: 0,
      imageUrl: null,
      availableSizes: variants.map(v => v.size),
      variants,
    });
  }

  const all = [
    ...grouped.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    ...standalone.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  ];
  return all;
}

// ── GET /api/catalog/families ─────────────────────────────────────────────────

router.get("/catalog/families", async (req: Request, res: Response) => {
  const lojaId = parseInt((req.query.lojaId as string) ?? "1", 10);
  const category = req.query.category as string | undefined;

  try {
    // If product_families table doesn't exist yet (pre-migration), treat as empty
    type FamilyRow = typeof productFamiliesTable.$inferSelect;
    let families: FamilyRow[] = [];
    try {
      families = await db
        .select()
        .from(productFamiliesTable)
        .where(eq(productFamiliesTable.isActive, true))
        .orderBy(asc(productFamiliesTable.ranking), asc(productFamiliesTable.name));
    } catch (tableErr: unknown) {
      const msg = tableErr instanceof Error ? tableErr.message : "";
      // Postgres 42P01: "relation 'product_families' does not exist"
      if (!msg.includes("product_families") && !msg.includes("42P01")) throw tableErr;
      // Fall through to crawler-based derivation
    }

    // Fallback: Castor Core empty or not yet created → derive from crawler data
    if (families.length === 0) {
      let fallback = await deriveFamiliesFromProdutos(lojaId);
      if (category) fallback = fallback.filter(f => f.category === category);
      res.json(fallback);
      return;
    }

    // Filter by category if requested
    const filtered = category
      ? families.filter(f => f.category === category)
      : families;

    // Enrich with current prices from produtosTable
    const familyIds = filtered.map(f => f.id);
    const products =
      familyIds.length > 0
        ? await db
            .select()
            .from(produtosTable)
            .where(
              and(
                inArray(produtosTable.familySlug, familyIds),
                eq(produtosTable.disponivel, true),
                eq(produtosTable.lojaId, lojaId)
              )
            )
        : [];

    // Index products by familySlug → size
    const productIndex = new Map<string, Map<ProductSize, typeof products[number]>>();
    for (const p of products) {
      const size = normalizeSize(p.size);
      if (!p.familySlug || !size) continue;
      if (!productIndex.has(p.familySlug)) {
        productIndex.set(p.familySlug, new Map());
      }
      // First product wins per size (should be unique)
      if (!productIndex.get(p.familySlug)!.has(size)) {
        productIndex.get(p.familySlug)!.set(size, p);
      }
    }

    const result: CatalogFamily[] = filtered.map(family => {
      const availableSizes = (family.availableSizes ?? ["Solteiro", "Casal", "Queen", "King"] as ProductSize[])
        .slice()
        .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));

      const sizeMap = productIndex.get(family.id) ?? new Map<ProductSize, typeof products[number]>();

      const variants: CatalogVariant[] = availableSizes.map(size => {
        const p = sizeMap.get(size) ?? null;
        return {
          size,
          produtoId: p?.id ?? null,
          slug: p?.slug ?? null,
          preco: p?.preco ?? null,
          precoPix: p?.precoPix ?? null,
          parcelamento: p?.parcelamento ?? null,
          medidas: p?.medidas ?? null,
          altura: p?.altura ?? null,
          imagem: p?.imagem ?? family.imageUrl ?? null,
          disponivel: p?.disponivel ?? false,
          encomenda: p?.encomenda ?? false,
          estoque: p?.estoque ?? null,
        };
      });

      return {
        id: family.id,
        name: family.name,
        category: family.category,
        ranking: family.ranking,
        imageUrl: family.imageUrl,
        availableSizes,
        variants,
      };
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── GET /api/catalog/categories ───────────────────────────────────────────────

router.get("/catalog/categories", async (_req: Request, res: Response) => {
  try {
    const families = await db
      .select({ category: productFamiliesTable.category })
      .from(productFamiliesTable)
      .where(eq(productFamiliesTable.isActive, true));

    if (families.length === 0) {
      // Fallback from produtos
      const rows = await db
        .selectDistinct({ categoria: produtosTable.categoria })
        .from(produtosTable)
        .where(eq(produtosTable.disponivel, true));
      res.json(rows.map(r => r.categoria).filter(Boolean));
      return;
    }

    const cats = [...new Set(families.map(f => f.category))];
    res.json(cats);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── POST /api/catalog/families — create (dono only) ──────────────────────────

router.post("/catalog/families", async (req: Request, res: Response) => {
  const token = (req.headers["x-session-token"] ?? "") as string;
  const session = getSession(token);
  if (!session || !isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao dono" });
    return;
  }
  const { id, name, category, description, imageUrl, ranking, availableSizes } = req.body as {
    id: string; name: string; category: string;
    description?: string; imageUrl?: string;
    ranking?: number; availableSizes?: ProductSize[];
  };
  if (!id || !name || !category) {
    res.status(400).json({ error: "id, name e category são obrigatórios" });
    return;
  }
  try {
    const [created] = await db.insert(productFamiliesTable).values({
      id: id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      category,
      description: description ?? null,
      imageUrl: imageUrl ?? null,
      ranking: ranking ?? 0,
      availableSizes: availableSizes ?? ["Solteiro", "Casal", "Queen", "King"],
    }).returning();
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("duplicate")) {
      res.status(409).json({ error: "Família com este ID já existe" });
    } else {
      res.status(500).json({ error: "Erro interno" });
    }
  }
});

// ── PATCH /api/catalog/families/:id (dono only) ───────────────────────────────

router.patch("/catalog/families/:id", async (req: Request, res: Response) => {
  const token = (req.headers["x-session-token"] ?? "") as string;
  const session = getSession(token);
  if (!session || !isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao dono" });
    return;
  }
  const { id } = req.params as { id: string };
  const { name, category, description, imageUrl, ranking, availableSizes, isActive } = req.body as {
    name?: string; category?: string; description?: string;
    imageUrl?: string; ranking?: number; availableSizes?: ProductSize[];
    isActive?: boolean;
  };
  try {
    const [updated] = await db
      .update(productFamiliesTable)
      .set({
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(ranking !== undefined && { ranking }),
        ...(availableSizes !== undefined && { availableSizes }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(productFamiliesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Família não encontrada" }); return; }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── POST /api/catalog/families/seed (dono only) ───────────────────────────────
// One-time seed: populates productFamiliesTable from existing crawler data.

router.post("/catalog/families/seed", async (req: Request, res: Response) => {
  const token = (req.headers["x-session-token"] ?? "") as string;
  const session = getSession(token);
  if (!session || !isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao dono" });
    return;
  }
  const { overwrite = false } = req.body as { overwrite?: boolean };

  try {
    const existing = await db.select({ id: productFamiliesTable.id }).from(productFamiliesTable);
    const existingIds = new Set(existing.map(r => r.id));

    const products = await db
      .select({
        familySlug: produtosTable.familySlug,
        familyName: produtosTable.familyName,
        categoria: produtosTable.categoria,
        size: produtosTable.size,
      })
      .from(produtosTable)
      .where(eq(produtosTable.disponivel, true));

    // Collect unique families + their sizes
    const familyData = new Map<string, { name: string; category: string; sizes: Set<ProductSize> }>();
    for (const p of products) {
      if (!p.familySlug) continue;
      const size = normalizeSize(p.size);
      if (!familyData.has(p.familySlug)) {
        familyData.set(p.familySlug, {
          name: p.familyName ?? p.familySlug,
          category: p.categoria,
          sizes: new Set(),
        });
      }
      if (size) familyData.get(p.familySlug)!.sizes.add(size);
    }

    const toInsert: { id: string; name: string; category: string; availableSizes: ProductSize[] }[] = [];
    for (const [slug, { name, category, sizes }] of familyData) {
      if (!overwrite && existingIds.has(slug)) continue;
      const availableSizes = SIZE_ORDER.filter(s => sizes.has(s));
      if (availableSizes.length === 0) continue;
      toInsert.push({ id: slug, name, category, availableSizes });
    }

    if (toInsert.length === 0) {
      res.json({ inserted: 0, skipped: familyData.size });
      return;
    }

    await db.insert(productFamiliesTable)
      .values(toInsert)
      .onConflictDoNothing();

    res.json({ inserted: toInsert.length, skipped: familyData.size - toInsert.length });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
