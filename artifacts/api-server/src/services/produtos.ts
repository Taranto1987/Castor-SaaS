import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import type { TenantKey } from "../config/tenants.js";

const TENANT_LOJA: Record<TenantKey, number> = {
  "cabo-frio": 1,
  "araruama": 2,
  "default": 1,
};

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
        eq(produtosTable.lojaId, TENANT_LOJA[tenant] ?? 1),
        eq(produtosTable.disponivel, true)
      )
    );

  return rows;
}
