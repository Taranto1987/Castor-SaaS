import { extractFamilyInfo } from "@workspace/db";
import { TABELA_MESTRE } from "../../medidas";
import type { ProdutoRow, MappedProduto, MappedProdutoPublic } from "./types";

export function deduplicateBySku<T extends { id: number; sku?: string | null }>(rows: T[]): T[] {
  const seen = new Map<string, number>();
  return rows.filter(r => {
    if (!r.sku) return true;
    if (seen.has(r.sku)) return false;
    seen.set(r.sku, r.id);
    return true;
  });
}

function extractGallery(p: ProdutoRow): Array<{ url: string; label: string | null }> {
  const ft = p.fichaTecnica as Record<string, unknown> | null;
  const raw = ft?._raw as Record<string, unknown> | undefined;
  const gallery = raw?.media_gallery as Array<{ url: string; label: string | null }> | undefined;
  if (Array.isArray(gallery) && gallery.length > 0) return gallery;
  if (p.imagem) return [{ url: p.imagem, label: p.nome }];
  return [];
}

export function mapProduto(p: ProdutoRow): MappedProduto {
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
    medida: p.medida,
    categoriaInterna: p.categoriaInterna,
    // nomeExibido deriva da Tabela Mestre pela medida canônica (SSOT), nunca do nome.
    nomeExibido: p.medida ? (TABELA_MESTRE[p.medida]?.nomeExibido ?? null) : null,
    statusMedida: p.statusMedida,
    descricao: p.descricao,
    fichaTecnica: p.fichaTecnica as Record<string, unknown> | null,
    imagens: extractGallery(p),
    criadoEm: p.criadoEm,
  };
}

export function mapProdutoPublic(p: ProdutoRow): MappedProdutoPublic {
  const { custoBRL: _c, precoBase: _pb, factoryCost: _fc, outletMarkupPercent: _om, ...pub } = mapProduto(p);
  return pub;
}
