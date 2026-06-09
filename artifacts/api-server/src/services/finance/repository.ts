import { db } from "@workspace/db";
import {
  despesasTable,
  despesasRecorrentesTable,
  comissoesConfigTable,
  metasTable,
  orcamentosTable,
  produtosTable,
} from "@workspace/db/schema";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";

export async function findDespesas(inicio: Date, fim: Date, categoria?: string, lojaId = 1) {
  const conditions = [
    eq(despesasTable.lojaId, lojaId),
    gte(despesasTable.data, inicio),
    lte(despesasTable.data, fim),
  ];
  if (categoria) conditions.push(eq(despesasTable.categoria, categoria));
  return db.select().from(despesasTable).where(and(...conditions)).orderBy(desc(despesasTable.data));
}

export async function findDespesasConfirmadas(inicio: Date, fim: Date, lojaId = 1) {
  return db.select().from(despesasTable).where(
    and(eq(despesasTable.lojaId, lojaId), gte(despesasTable.data, inicio), lte(despesasTable.data, fim), eq(despesasTable.confirmada, true))
  );
}

export async function createDespesa(data: {
  lojaId?: number;
  valor: string;
  categoria: string;
  descricao?: string | null;
  comprovante?: string | null;
  recorrente?: boolean;
  data?: Date;
}) {
  const [row] = await db.insert(despesasTable).values(data).returning();
  return row;
}

export async function updateDespesa(id: number, updates: Partial<{
  valor: string;
  categoria: string;
  descricao: string | null;
  comprovante: string | null;
  confirmada: boolean;
  data: Date;
}>, lojaId?: number) {
  const where = lojaId
    ? and(eq(despesasTable.id, id), eq(despesasTable.lojaId, lojaId))
    : eq(despesasTable.id, id);
  const [row] = await db.update(despesasTable).set(updates).where(where).returning();
  return row ?? null;
}

export async function deleteDespesa(id: number, lojaId?: number) {
  const where = lojaId
    ? and(eq(despesasTable.id, id), eq(despesasTable.lojaId, lojaId))
    : eq(despesasTable.id, id);
  await db.delete(despesasTable).where(where);
}

export async function updateDespesaComprovante(id: number, base64: string, lojaId?: number) {
  const where = lojaId
    ? and(eq(despesasTable.id, id), eq(despesasTable.lojaId, lojaId))
    : eq(despesasTable.id, id);
  const [row] = await db.update(despesasTable).set({ comprovante: base64 }).where(where).returning();
  return row ?? null;
}

export async function findDespesasRecorrentes(lojaId = 1) {
  return db.select().from(despesasRecorrentesTable)
    .where(and(eq(despesasRecorrentesTable.lojaId, lojaId), eq(despesasRecorrentesTable.ativo, true)))
    .orderBy(despesasRecorrentesTable.descricao);
}

export async function createDespesaRecorrente(data: {
  lojaId?: number;
  valor: string;
  categoria: string;
  descricao?: string | null;
  diaVencimento?: number;
}) {
  const [row] = await db.insert(despesasRecorrentesTable).values(data).returning();
  return row;
}

export async function disableDespesaRecorrente(id: number) {
  await db.update(despesasRecorrentesTable).set({ ativo: false }).where(eq(despesasRecorrentesTable.id, id));
}

export async function findDespesasRecorrentesNoMes(inicio: Date, fim: Date, lojaId = 1) {
  return db.select().from(despesasTable).where(
    and(eq(despesasTable.lojaId, lojaId), eq(despesasTable.recorrente, true), gte(despesasTable.data, inicio), lte(despesasTable.data, fim))
  );
}

export async function findComissoesConfig(lojaId = 1) {
  return db.select().from(comissoesConfigTable)
    .where(eq(comissoesConfigTable.lojaId, lojaId))
    .orderBy(comissoesConfigTable.vendedor);
}

export async function upsertComissaoConfig(vendedor: string, percentual: string, lojaId = 1) {
  const existing = await db.select().from(comissoesConfigTable)
    .where(and(eq(comissoesConfigTable.vendedor, vendedor), eq(comissoesConfigTable.lojaId, lojaId)))
    .limit(1);
  if (existing.length > 0) {
    const [row] = await db.update(comissoesConfigTable)
      .set({ percentual })
      .where(eq(comissoesConfigTable.id, existing[0].id))
      .returning();
    return row;
  }
  const [row] = await db.insert(comissoesConfigTable).values({ lojaId, vendedor, percentual }).returning();
  return row;
}

export async function findVendasPeriodo(inicio: Date, fim: Date, lojaId = 1) {
  // Use vendidoEm (sale close date) when available, fall back to criadoEm for older records.
  // This ensures sales closed in a different month than their orçamento creation date
  // are correctly attributed to the month they were actually closed.
  return db.select().from(orcamentosTable).where(
    and(
      eq(orcamentosTable.lojaId, lojaId),
      eq(orcamentosTable.status, "vendido"),
      sql`COALESCE(${orcamentosTable.vendidoEm}, ${orcamentosTable.criadoEm}) >= ${inicio}`,
      sql`COALESCE(${orcamentosTable.vendidoEm}, ${orcamentosTable.criadoEm}) <= ${fim}`,
    )
  );
}

export async function findOrcamentosPeriodo(inicio: Date, fim: Date, lojaId = 1) {
  return db.select().from(orcamentosTable).where(
    and(eq(orcamentosTable.lojaId, lojaId), gte(orcamentosTable.criadoEm, inicio), lte(orcamentosTable.criadoEm, fim))
  );
}

export async function findOrcamentosPendentes(lojaId = 1) {
  return db.select().from(orcamentosTable).where(
    and(eq(orcamentosTable.lojaId, lojaId), eq(orcamentosTable.status, "pendente"))
  );
}

export async function findMeta(mes: number, ano: number, operacao: string) {
  const [row] = await db.select().from(metasTable).where(
    and(eq(metasTable.mes, mes), eq(metasTable.ano, ano), eq(metasTable.operacao, operacao))
  );
  return row ?? null;
}

export async function upsertMeta(mes: number, ano: number, valor: string, operacao: string) {
  const existing = await db.select().from(metasTable).where(
    and(eq(metasTable.mes, mes), eq(metasTable.ano, ano), eq(metasTable.operacao, operacao))
  );
  if (existing.length > 0) {
    const [row] = await db.update(metasTable).set({ valor }).where(eq(metasTable.id, existing[0].id)).returning();
    return row;
  }
  const [row] = await db.insert(metasTable).values({ mes, ano, valor, operacao }).returning();
  return row;
}

export async function findProdutosDisponiveis(lojaId = 1) {
  return db.select().from(produtosTable).where(
    and(eq(produtosTable.disponivel, true), eq(produtosTable.lojaId, lojaId))
  );
}
