import { db } from "@workspace/db";
import {
  usuariosTable,
  convitesTable,
  resetSenhaTokensTable,
  auditLogsTable,
  type Cargo,
} from "@workspace/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import crypto from "crypto";

export async function findUsuarioByEmail(email: string) {
  const [row] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.email, email.toLowerCase().trim()))
    .limit(1);
  return row ?? null;
}

export async function findUsuarioById(id: number) {
  const [row] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, id)).limit(1);
  return row ?? null;
}

export async function findUsuariosByLoja(lojaId: number) {
  return db
    .select({
      id: usuariosTable.id,
      nome: usuariosTable.nome,
      email: usuariosTable.email,
      cargo: usuariosTable.cargo,
      lojaId: usuariosTable.lojaId,
      operacao: usuariosTable.operacao,
      ativo: usuariosTable.ativo,
      ultimoLogin: usuariosTable.ultimoLogin,
      criadoEm: usuariosTable.criadoEm,
    })
    .from(usuariosTable)
    .where(eq(usuariosTable.lojaId, lojaId))
    .orderBy(desc(usuariosTable.criadoEm));
}

export async function createUsuario(data: {
  nome: string;
  email: string;
  lojaId: number;
  cargo: Cargo;
  operacao: string;
  wa?: string | null;
  waRaw?: string | null;
  tom?: string | null;
  header?: string | null;
  assinatura?: string | null;
}) {
  const [row] = await db
    .insert(usuariosTable)
    .values({ ...data, email: data.email.toLowerCase().trim(), senhaHash: null })
    .returning();
  return row;
}

export async function updateUsuarioEmail(id: number, email: string) {
  const [row] = await db
    .update(usuariosTable)
    .set({ email: email.toLowerCase().trim() })
    .where(eq(usuariosTable.id, id))
    .returning({ id: usuariosTable.id, email: usuariosTable.email });
  return row ?? null;
}

export async function updateUsuarioSenha(id: number, senhaHash: string) {
  const [row] = await db
    .update(usuariosTable)
    .set({ senhaHash })
    .where(eq(usuariosTable.id, id))
    .returning();
  return row ?? null;
}

export async function updateUsuarioCargo(id: number, cargo: Cargo) {
  const [row] = await db
    .update(usuariosTable)
    .set({ cargo })
    .where(eq(usuariosTable.id, id))
    .returning({ id: usuariosTable.id, cargo: usuariosTable.cargo });
  return row ?? null;
}

export async function toggleUsuarioAtivo(id: number, ativo: boolean) {
  const [row] = await db
    .update(usuariosTable)
    .set({ ativo })
    .where(eq(usuariosTable.id, id))
    .returning({ id: usuariosTable.id, ativo: usuariosTable.ativo });
  return row ?? null;
}

export async function updateUltimoLogin(id: number) {
  await db.update(usuariosTable).set({ ultimoLogin: new Date() }).where(eq(usuariosTable.id, id));
}

// ─── Convites ──────────────────────────────────────────────────────────────

export function gerarToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createConvite(usuarioId: number) {
  const token = gerarToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
  await db.delete(convitesTable).where(eq(convitesTable.usuarioId, usuarioId));
  const [row] = await db
    .insert(convitesTable)
    .values({ usuarioId, token, expiresAt })
    .returning();
  return row;
}

export async function findConviteValido(token: string) {
  const [row] = await db
    .select()
    .from(convitesTable)
    .where(
      and(
        eq(convitesTable.token, token),
        eq(convitesTable.usado, false),
        gt(convitesTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function marcarConviteUsado(id: number) {
  await db.update(convitesTable).set({ usado: true }).where(eq(convitesTable.id, id));
}

// ─── Reset de senha ────────────────────────────────────────────────────────

export async function createResetToken(usuarioId: number) {
  const token = gerarToken();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h
  await db.delete(resetSenhaTokensTable).where(eq(resetSenhaTokensTable.usuarioId, usuarioId));
  const [row] = await db
    .insert(resetSenhaTokensTable)
    .values({ usuarioId, token, expiresAt })
    .returning();
  return row;
}

export async function findResetTokenValido(token: string) {
  const [row] = await db
    .select()
    .from(resetSenhaTokensTable)
    .where(
      and(
        eq(resetSenhaTokensTable.token, token),
        eq(resetSenhaTokensTable.usado, false),
        gt(resetSenhaTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function marcarResetTokenUsado(id: number) {
  await db.update(resetSenhaTokensTable).set({ usado: true }).where(eq(resetSenhaTokensTable.id, id));
}

// ─── Audit ─────────────────────────────────────────────────────────────────

export async function registrarAudit(data: {
  lojaId?: number;
  usuarioId?: number;
  acao: string;
  detalhes?: Record<string, unknown>;
  ip?: string;
}) {
  await db.insert(auditLogsTable).values(data).catch(() => {});
}
