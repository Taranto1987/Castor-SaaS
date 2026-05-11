import { db } from "@workspace/db";
import { orcamentosTable } from "@workspace/db/schema";
import type { TenantKey } from "../config/tenants.js";

const TENANT_LOJA: Record<TenantKey, number> = {
  "cabo-frio": 1,
  "araruama": 2,
  "default": 1,
};
import type { ProdutoResumido } from "./produtos.js";

interface CriarOrcamentoParams {
  tenant: TenantKey;
  telefone: string;
  produtos: ProdutoResumido[];
  cliente?: string;
  observacoes?: string;
}

export async function criarOrcamento({
  tenant,
  telefone,
  produtos,
  cliente = "Cliente WhatsApp",
  observacoes,
}: CriarOrcamentoParams) {
  const totalPix = produtos.reduce((acc, p) => {
    const v = parseFloat(p.precoPix?.replace(/[^\d,]/g, "").replace(",", ".") ?? "0");
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  const texto = produtos.length > 0
    ? produtos.map((p) => `${p.nome} — ${p.precoPix ?? p.preco}`).join("\n")
    : "Nenhum produto selecionado";

  const [orcamento] = await db
    .insert(orcamentosTable)
    .values({
      lojaId: TENANT_LOJA[tenant] ?? 1,
      cliente,
      whatsapp: telefone,
      produtosJson: produtos,
      observacoes: observacoes ?? null,
      totalPix: totalPix.toFixed(2),
      texto,
      status: "pendente",
    })
    .returning();

  return orcamento;
}
