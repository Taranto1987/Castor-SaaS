import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq, and, ilike, or, desc } from "drizzle-orm";

export async function findProdutosDisponiveis(lojaId: number) {
  return db.select().from(produtosTable)
    .where(and(eq(produtosTable.disponivel, true), eq(produtosTable.lojaId, lojaId)))
    .orderBy(produtosTable.nome);
}

export async function findProdutoById(id: number, lojaId: number) {
  const [row] = await db.select().from(produtosTable)
    .where(and(eq(produtosTable.id, id), eq(produtosTable.lojaId, lojaId)));
  return row ?? null;
}

export async function findProdutosAll(lojaId: number) {
  return db.select().from(produtosTable)
    .where(eq(produtosTable.lojaId, lojaId))
    .orderBy(desc(produtosTable.criadoEm));
}

export async function searchProdutos(query: string, lojaId: number) {
  return db.select().from(produtosTable).where(
    and(
      eq(produtosTable.lojaId, lojaId),
      or(ilike(produtosTable.nome, `%${query}%`), ilike(produtosTable.sku, `%${query}%`))
    )
  );
}
