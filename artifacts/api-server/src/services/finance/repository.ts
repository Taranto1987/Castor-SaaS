import { db } from "@workspace/db";
import {
  despesasTable,
  despesasRecorrentesTable,
  comissoesConfigTable,
  metasTable,
  orcamentosTable,
  produtosTable,
} from "@workspace/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";

export async function findDespesas(inicio: Date, fim: Date, categoria?: string) {
  const conditions = [
    gte(despesasTable.data, inicio),
    lte(despesasTable.data, fim),
  ];
  if (categoria) conditions.push(eq(despesasTable.categoria, categoria));
  return db.select().from(despesasTable).where(and(...conditions)).orderBy(desc(despesasTable.data));
}

export async function findDespesasConfirmadas(inicio: Date, fim: Date) {
  return db.select().from(despesasTable).where(
    and(gte(despesasTable.data, inicio), lte(despesasTable.data, fim), eq(despesasTable.confirmada, true))
  );
}

export async function createDespesa(data: {
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
}>) {
  const [row] = await db.update(despesasTable).set(updates).where(eq(despesasTable.id, id)).returning();
  return row ?? null;
}

export async function deleteDespesa(id: number) {
  await db.delete(despesasTable).where(eq(despesasTable.id, id));
}

export async function updateDespesaComprovante(id: number, base64: string) {
  const [row] = await db.update(despesasTable).set({ comprovante: base64 }).where(eq(despesasTable.id, id)).returning();
  return row ?? null;
}

export async function findDespesasRecorrentes() {
  return db.select().from(despesasRecorrentesTable)
    .where(eq(despesasRecorrentesTable.ativo, true))
    .orderBy(despesasRecorrentesTable.descricao);
}

export async function createDespesaRecorrente(data: {
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

export async function findDespesasRecorrentesNoMes(inicio: Date, fim: Date) {
  return db.select().from(despesasTable).where(
    and(eq(despesasTable.recorrente, true), gte(despesasTable.data, inicio), lte(despesasTable.data, fim))
  );
}

export async function findComissoesConfig() {
  return db.select().from(comissoesConfigTable).orderBy(comissoesConfigTable.vendedor);
}

export async function upsertComissaoConfig(vendedor: string, percentual: string) {
  const existing = await db.select().from(comissoesConfigTable).where(eq(comissoesConfigTable.vendedor, vendedor)).limit(1);
  if (existing.length > 0) {
    const [row] = await db.update(comissoesConfigTable).set({ percentual }).where(eq(comissoesConfigTable.vendedor, vendedor)).returning();
    return row;
  }
  const [row] = await db.insert(comissoesConfigTable).values({ vendedor, percentual }).returning();
  return row;
}

export async function findVendasPeriodo(inicio: Date, fim: Date) {
  return db.select().from(orcamentosTable).where(
    and(eq(orcamentosTable.status, "vendido"), gte(orcamentosTable.criadoEm, inicio), lte(orcamentosTable.criadoEm, fim))
  );
}

export async function findOrcamentosPeriodo(inicio: Date, fim: Date) {
  return db.select().from(orcamentosTable).where(
    and(gte(orcamentosTable.criadoEm, inicio), lte(orcamentosTable.criadoEm, fim))
  );
}

export async function findOrcamentosPendentes() {
  return db.select().from(orcamentosTable).where(eq(orcamentosTable.status, "pendente"));
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

export async function findProdutosDisponiveis() {
  return db.select().from(produtosTable).where(eq(produtosTable.disponivel, true));
}
