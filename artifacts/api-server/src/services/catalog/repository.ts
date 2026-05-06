import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq, ilike, or, and, desc } from "drizzle-orm";

export async function findProdutosDisponiveis() {
  return db.select().from(produtosTable)
    .where(eq(produtosTable.disponivel, true))
    .orderBy(produtosTable.nome);
}

export async function findProdutoById(id: number) {
  const [row] = await db.select().from(produtosTable).where(eq(produtosTable.id, id));
  return row ?? null;
}

export async function findProdutosAll() {
  return db.select().from(produtosTable).orderBy(desc(produtosTable.criadoEm));
}

export async function searchProdutos(query: string) {
  return db.select().from(produtosTable).where(
    or(ilike(produtosTable.nome, `%${query}%`), ilike(produtosTable.sku, `%${query}%`))
  );
}
