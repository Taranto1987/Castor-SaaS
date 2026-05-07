import { db } from "@workspace/db";
import { produtosTable, orcamentosTable, entregasTable } from "@workspace/db/schema";
import { inArray, desc, eq } from "drizzle-orm";

export async function findProdutosByIds(ids: number[]) {
  return db.select().from(produtosTable).where(inArray(produtosTable.id, ids));
}

export async function saveOrcamento(data: {
  cliente: string;
  whatsapp?: string | null;
  produtosJson?: unknown;
  observacoes?: string | null;
  descontoPix?: number;
  totalPix?: string | null;
  totalPrazo?: string | null;
  texto: string;
  vendedor?: string | null;
  precoBaseTotal?: string | null;
  descontoAplicado?: string | null;
}) {
  const [row] = await db.insert(orcamentosTable).values({
    cliente: data.cliente,
    whatsapp: data.whatsapp || null,
    produtosJson: data.produtosJson || [],
    observacoes: data.observacoes || null,
    descontoPix: data.descontoPix || 0,
    totalPix: data.totalPix || null,
    totalPrazo: data.totalPrazo || null,
    texto: data.texto,
    vendedor: data.vendedor || null,
    status: "pendente",
    precoBaseTotal: data.precoBaseTotal || null,
    descontoAplicado: data.descontoAplicado || null,
  }).returning();
  return row;
}

const HISTORICO_COLS = {
  id: orcamentosTable.id,
  cliente: orcamentosTable.cliente,
  whatsapp: orcamentosTable.whatsapp,
  status: orcamentosTable.status,
  vendedor: orcamentosTable.vendedor,
  totalPix: orcamentosTable.totalPix,
  totalPrazo: orcamentosTable.totalPrazo,
  descontoPix: orcamentosTable.descontoPix,
  observacoes: orcamentosTable.observacoes,
  produtosJson: orcamentosTable.produtosJson,
  criadoEm: orcamentosTable.criadoEm,
};

export async function findHistorico(papel: string, vendedor: string, page: number) {
  const limit = 50;
  const offset = page * limit;
  if (papel === "dono") {
    return db.select(HISTORICO_COLS).from(orcamentosTable)
      .orderBy(desc(orcamentosTable.criadoEm)).limit(limit).offset(offset);
  }
  return db.select(HISTORICO_COLS).from(orcamentosTable)
    .where(eq(orcamentosTable.vendedor, vendedor))
    .orderBy(desc(orcamentosTable.criadoEm)).limit(limit).offset(offset);
}

export async function findOrcamentoById(id: number) {
  const [row] = await db.select().from(orcamentosTable).where(eq(orcamentosTable.id, id));
  return row ?? null;
}

export async function fecharVendaTransaction(id: number, orc: {
  cliente: string;
  whatsapp?: string | null;
  vendedor?: string | null;
  produtosJson?: unknown;
}, opts: { endereco?: string; observacoes?: string; dataEntrega?: string }) {
  const produtosJson = Array.isArray(orc.produtosJson) ? orc.produtosJson as { id?: number; nome?: string }[] : [];
  const produtos = produtosJson.map((p) => p.nome).filter(Boolean).join(", ");
  const qtdPorId = new Map<number, number>();
  for (const p of produtosJson) {
    if (p.id) qtdPorId.set(p.id, (qtdPorId.get(p.id) || 0) + 1);
  }

  return db.transaction(async (tx) => {
    await tx.update(orcamentosTable).set({ status: "vendido" }).where(eq(orcamentosTable.id, id));

    if (qtdPorId.size > 0) {
      const prods = await tx.select().from(produtosTable).where(inArray(produtosTable.id, [...qtdPorId.keys()]));
      for (const prod of prods) {
        if (prod.estoque !== null && prod.estoque > 0) {
          const qty = qtdPorId.get(prod.id) || 1;
          const novoEstoque = Math.max(0, prod.estoque - qty);
          await tx.update(produtosTable)
            .set({ estoque: novoEstoque, disponivel: novoEstoque > 0 })
            .where(eq(produtosTable.id, prod.id));
        }
      }
    }

    const [entrega] = await tx.insert(entregasTable).values({
      orcamentoId: id,
      cliente: orc.cliente,
      whatsapp: orc.whatsapp || null,
      endereco: opts.endereco || null,
      produtos: produtos || null,
      vendedor: orc.vendedor || null,
      status: "pendente",
      observacoes: opts.observacoes || null,
      dataEntrega: opts.dataEntrega || null,
    }).returning();

    return entrega;
  });
}
