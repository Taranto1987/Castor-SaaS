import { db } from "@workspace/db";
import { produtosTable, lojasTable, productFamiliesTable } from "@workspace/db/schema";
import { normalizeSize, SIZE_ORDER } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { resolverTermoBusca, TABELA_MESTRE } from "../../medidas";

// ── Return types ──────────────────────────────────────────────────────────────

export interface ProductResult {
  id: number;
  nome: string;
  categoria: string;
  preco: string | null;
  precoPix: string | null;
  parcelamento: string | null;
  medidas: string | null;
  altura: string | null;
  size: string | null;
  familySlug: string | null;
  familyName: string | null;
  disponivel: boolean;
  encomenda: boolean;
  slug: string | null;
  // ── Dicionário Mestre de Medidas (SSOT) ──
  medida: string | null;
  categoriaInterna: string | null; // SOLTEIRO | CASAL | QUEEN | ... | NAO_MAPEADA
  nomeExibido: string | null; // rótulo canônico da categoria de tamanho
  statusMedida: string | null; // 'padrao' | 'sob_encomenda' — sob_encomenda NÃO recebe link
}

export interface FamilyVariant {
  size: string;
  preco: string | null;
  precoPix: string | null;
  parcelamento: string | null;
  medidas: string | null;
  disponivel: boolean;
  encomenda: boolean;
  estoque: number | null;
}

export interface FamilyResult {
  id: string;
  name: string;
  category: string;
  variants: FamilyVariant[];
}

export interface StoreInfo {
  id: number;
  nome: string;
  responsavel: string | null;
  whatsapp: string | null;
  endereco: string | null;
  cidade: string | null;
}

// ── Tool implementations ──────────────────────────────────────────────────────

export async function searchProducts(params: {
  query: string;
  category?: string;
  lojaId: number;
}): Promise<ProductResult[]> {
  const { query, category, lojaId } = params;

  // Split into individual terms so "casal médio" also matches products where
  // "Casal" is in the size column and the model name doesn't contain that word.
  const terms = query.trim().split(/\s+/).filter(t => t.length > 1);
  const fullQ = `%${query}%`;

  // SSOT: se a query é uma MEDIDA ou um SINÔNIMO de tamanho ("96x203",
  // "solteirão", "solteiro king"), resolve para uma categoria de tamanho e
  // filtra por categoria_interna — nunca por nome. Assim os três termos acima
  // retornam exatamente o mesmo conjunto (SOLTEIRAO). Termos de tecnologia
  // (pocket, gel, látex) não resolvem categoria e caem na busca textual.
  const categoriaTamanho = resolverTermoBusca(query);

  const searchConds = or(
    ilike(produtosTable.nome, fullQ),
    ilike(produtosTable.sku, fullQ),
    ilike(produtosTable.size, fullQ),
    ilike(produtosTable.familyName, fullQ),
    ...terms.flatMap(t => [
      ilike(produtosTable.nome, `%${t}%`),
      ilike(produtosTable.size, `%${t}%`),
      ilike(produtosTable.familyName, `%${t}%`),
    ]),
  );

  const rows = await db
    .select()
    .from(produtosTable)
    .where(
      and(
        eq(produtosTable.disponivel, true),
        eq(produtosTable.lojaId, lojaId),
        categoriaTamanho
          ? eq(produtosTable.categoriaInterna, categoriaTamanho)
          : searchConds,
        ...(category ? [eq(produtosTable.categoria, category)] : []),
      )
    )
    .limit(20);

  return rows.map(p => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    preco: p.preco ?? null,
    precoPix: p.precoPix ?? null,
    parcelamento: p.parcelamento ?? null,
    medidas: p.medidas ?? null,
    altura: p.altura ?? null,
    size: p.size ?? null,
    familySlug: p.familySlug ?? null,
    familyName: p.familyName ?? null,
    disponivel: p.disponivel ?? true,
    encomenda: p.encomenda ?? false,
    slug: p.slug ?? null,
    medida: p.medida ?? null,
    categoriaInterna: p.categoriaInterna ?? null,
    nomeExibido: p.medida ? (TABELA_MESTRE[p.medida]?.nomeExibido ?? null) : null,
    statusMedida: p.statusMedida ?? null,
  }));
}

export async function getCatalog(params: {
  category?: string;
  lojaId: number;
}): Promise<FamilyResult[]> {
  const { category, lojaId } = params;

  const products = await db
    .select()
    .from(produtosTable)
    .where(
      and(
        eq(produtosTable.disponivel, true),
        eq(produtosTable.lojaId, lojaId),
        ...(category ? [eq(produtosTable.categoria, category)] : []),
      )
    );

  // Try productFamiliesTable first for canonical names/order
  const familyNames: Record<string, string> = {};
  try {
    const families = await db.select({ id: productFamiliesTable.id, name: productFamiliesTable.name })
      .from(productFamiliesTable)
      .where(eq(productFamiliesTable.isActive, true));
    for (const f of families) familyNames[f.id] = f.name;
  } catch {
    // Table may not exist yet — skip
  }

  const familyMap = new Map<string, { name: string; category: string; variants: Map<string, FamilyVariant> }>();

  for (const p of products) {
    const size = normalizeSize(p.size);
    if (!p.familySlug) continue;

    const key = `${p.categoria}::${p.familySlug}`;
    if (!familyMap.has(key)) {
      familyMap.set(key, {
        name: familyNames[p.familySlug] ?? p.familyName ?? p.nome,
        category: p.categoria,
        variants: new Map(),
      });
    }
    const entry = familyMap.get(key)!;
    const sizeKey = size ?? p.size ?? "Único";
    if (!entry.variants.has(sizeKey)) {
      entry.variants.set(sizeKey, {
        size: sizeKey,
        preco: p.preco ?? null,
        precoPix: p.precoPix ?? null,
        parcelamento: p.parcelamento ?? null,
        medidas: p.medidas ?? null,
        disponivel: p.disponivel ?? true,
        encomenda: p.encomenda ?? false,
        estoque: p.estoque ?? null,
      });
    }
  }

  const result: FamilyResult[] = [];
  for (const [, { name, category: cat, variants }] of familyMap) {
    const sorted = [...variants.values()].sort(
      (a, b) => SIZE_ORDER.indexOf(a.size as never) - SIZE_ORDER.indexOf(b.size as never)
    );
    result.push({ id: name, name, category: cat, variants: sorted });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getProductFamily(params: {
  familyId: string;
  lojaId: number;
}): Promise<FamilyResult | null> {
  const { familyId, lojaId } = params;

  const products = await db
    .select()
    .from(produtosTable)
    .where(
      and(
        eq(produtosTable.familySlug, familyId),
        eq(produtosTable.lojaId, lojaId),
      )
    );

  if (products.length === 0) return null;

  let familyName = products[0]?.familyName ?? products[0]?.nome ?? familyId;
  try {
    const [row] = await db.select({ name: productFamiliesTable.name })
      .from(productFamiliesTable)
      .where(eq(productFamiliesTable.id, familyId));
    if (row) familyName = row.name;
  } catch { /* skip */ }

  const variantMap = new Map<string, FamilyVariant>();
  for (const p of products) {
    const size = normalizeSize(p.size) ?? p.size ?? "Único";
    if (!variantMap.has(size)) {
      variantMap.set(size, {
        size,
        preco: p.preco ?? null,
        precoPix: p.precoPix ?? null,
        parcelamento: p.parcelamento ?? null,
        medidas: p.medidas ?? null,
        disponivel: p.disponivel ?? true,
        encomenda: p.encomenda ?? false,
        estoque: p.estoque ?? null,
      });
    }
  }

  const variants = [...variantMap.values()].sort(
    (a, b) => SIZE_ORDER.indexOf(a.size as never) - SIZE_ORDER.indexOf(b.size as never)
  );

  return {
    id: familyId,
    name: familyName,
    category: products[0]?.categoria ?? "colchoes",
    variants,
  };
}

export async function getStoreInfo(params: { lojaId: number }): Promise<StoreInfo | null> {
  const [loja] = await db
    .select()
    .from(lojasTable)
    .where(eq(lojasTable.id, params.lojaId))
    .limit(1);

  if (!loja) return null;

  return {
    id: loja.id,
    nome: loja.nome,
    responsavel: loja.responsavel ?? null,
    whatsapp: loja.whatsappDisplay ?? loja.whatsappNumero ?? null,
    endereco: loja.endereco ?? null,
    cidade: loja.cidade ?? null,
  };
}
