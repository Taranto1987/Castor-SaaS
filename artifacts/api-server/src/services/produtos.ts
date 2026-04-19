import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import type { TenantKey } from "../config/tenants.js";

export type ProdutoResumido = {
  id: number;
  nome: string;
  categoria: string;
  preco: string | null;
  precoPix: string | null;
  precoBase: string | null;
  medidas: string | null;
  disponivel: boolean;
  encomenda: boolean;
};

export async function buscarProdutos(
  tenant: TenantKey
): Promise<ProdutoResumido[]> {
  const rows = await db
    .select({
      id: produtosTable.id,
      nome: produtosTable.nome,
      categoria: produtosTable.categoria,
      preco: produtosTable.preco,
      precoPix: produtosTable.precoPix,
      precoBase: produtosTable.precoBase,
      medidas: produtosTable.medidas,
      disponivel: produtosTable.disponivel,
      encomenda: produtosTable.encomenda,
    })
    .from(produtosTable)
    .where(
      and(
        eq(produtosTable.tenantId, tenant),
        eq(produtosTable.disponivel, true)
      )
    );

  return rows;
}
