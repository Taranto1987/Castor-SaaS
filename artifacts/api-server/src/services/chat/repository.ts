import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getProductContext(lojaId = 1): Promise<string> {
  try {
    const allProducts = await db
      .select({
        id: produtosTable.id,
        nome: produtosTable.nome,
        categoria: produtosTable.categoria,
        precoPix: produtosTable.precoPix,
        preco: produtosTable.preco,
        parcelamento: produtosTable.parcelamento,
        medidas: produtosTable.medidas,
        altura: produtosTable.altura,
      })
      .from(produtosTable)
      .where(and(eq(produtosTable.disponivel, true), eq(produtosTable.lojaId, lojaId)));

    if (allProducts.length === 0) return "Catálogo vazio no momento.";

    const grouped: Record<string, typeof allProducts> = {};
    for (const p of allProducts) {
      const cat = p.categoria || "outros";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    let ctx = "## Produtos Disponíveis (use o ID ao recomendar)\n\n";
    for (const [cat, items] of Object.entries(grouped)) {
      ctx += `### ${cat}\n`;
      for (const p of items.slice(0, 15)) {
        ctx += `- [ID:${p.id}] **${p.nome}**`;
        if (p.medidas) ctx += ` (${p.medidas})`;
        if (p.precoPix) ctx += ` — PIX: ${p.precoPix}`;
        if (p.preco) ctx += ` | Prazo: ${p.preco}`;
        if (p.parcelamento) ctx += ` (${p.parcelamento})`;
        ctx += "\n";
      }
      if (items.length > 15) ctx += ` ... e mais ${items.length - 15} produtos\n`;
      ctx += "\n";
    }
    return ctx;
  } catch {
    return "Catálogo temporariamente indisponível.";
  }
}

/** Compact product hint block: top 4 recent items + tool instruction (~60 tokens). */
export async function getProductContextCompact(lojaId: number, maxItems = 4): Promise<string> {
  try {
    const rows = await db
      .select({
        id: produtosTable.id,
        nome: produtosTable.nome,
        precoPix: produtosTable.precoPix,
      })
      .from(produtosTable)
      .where(and(eq(produtosTable.disponivel, true), eq(produtosTable.lojaId, lojaId)))
      .orderBy(desc(produtosTable.criadoEm))
      .limit(maxItems);

    if (rows.length === 0) return "Use search_products para consultar o catálogo.";

    const lines = rows.map(p => `[ID:${p.id}] ${p.nome} — PIX: ${p.precoPix ?? "sob consulta"}`);
    return `Destaques recentes:\n${lines.join("\n")}\n\nUse search_products ou get_catalog para o catálogo completo.`;
  } catch {
    return "Use search_products para consultar o catálogo.";
  }
}
