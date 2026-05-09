import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { colaboradoresTable, usuariosTable, type Cargo } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { updateUltimoLogin, registrarAudit } from "../services/usuarios/repository";

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  token: string;
  userId: number;
  nome: string;
  cargo: Cargo;
  /** @deprecated usar cargo. Mantido para compatibilidade de rotas existentes. */
  papel: string;
  operacao: string;
  lojaId: number;
  wa: string;
  waRaw: string;
  tom: string;
  header: string;
  assinatura: string;
  criadoEm: number;
}

const LOJA_BY_OPERACAO: Record<string, number> = {
  cabo_frio: 1,
  araruama: 2,
};

// Mapa cargo → papel legado para compatibilidade das rotas existentes
const CARGO_TO_PAPEL: Record<string, string> = {
  ADMIN: "dono",
  GERENTE: "dono",
  VENDEDOR: "vendedor",
  FINANCEIRO: "financeiro",
  ENTREGA: "entrega",
};

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Seed ─────────────────────────────────────────────────────────────────────

const SEED_USUARIOS = [
  {
    email: "thalles@castor.local",
    senha: "THALLES",
    nome: "Thalles",
    cargo: "ADMIN" as Cargo,
    lojaId: 1,
    operacao: "cabo_frio",
    wa: "(22) 99241-0112",
    waRaw: "5522992410112",
    tom: "especialista",
    header: "🛏️ CASTOR CABO FRIO | ThallesZzz",
    assinatura: "ThallesZzz — Especialista em Sono",
  },
  {
    email: "admin@castor.local",
    senha: "CASTOR2",
    nome: "Administrador",
    cargo: "ADMIN" as Cargo,
    lojaId: 1,
    operacao: "cabo_frio",
    wa: "(22) 99241-0112",
    waRaw: "5522992410112",
    tom: "especialista",
    header: "🏪 CASTOR CABO FRIO",
    assinatura: "Castor Cabo Frio",
  },
  {
    email: "marcela@castor.local",
    senha: "MARCELA",
    nome: "Marcela Taranto",
    cargo: "VENDEDOR" as Cargo,
    lojaId: 1,
    operacao: "cabo_frio",
    wa: "(22) 98844-7240",
    waRaw: "5522988447240",
    tom: "acolhedor",
    header: "🏪 CASTOR CABO FRIO | Marcela",
    assinatura: "Marcela Taranto — Castor Cabo Frio",
  },
  {
    email: "vagner@castor.local",
    senha: "VAGNER",
    nome: "Vagner",
    cargo: "VENDEDOR" as Cargo,
    lojaId: 1,
    operacao: "cabo_frio",
    wa: "(22) 98832-7816",
    waRaw: "5522988327816",
    tom: "direto",
    header: "🏪 CASTOR CABO FRIO | Vagner",
    assinatura: "Vagner — Castor Cabo Frio",
  },
  {
    email: "nete@castor.local",
    senha: "NETE",
    nome: "Nete Rafaele",
    cargo: "VENDEDOR" as Cargo,
    lojaId: 2,
    operacao: "araruama",
    wa: "(22) 98824-9183",
    waRaw: "5522988249183",
    tom: "proximo",
    header: "💙 CASTOR ARARUAMA | Nete",
    assinatura: "Nete Rafaele — Castor Araruama",
  },
  {
    email: "pedropaulo@castor.local",
    senha: "PEDROPAULO",
    nome: "Pedro Paulo",
    cargo: "VENDEDOR" as Cargo,
    lojaId: 2,
    operacao: "araruama",
    wa: "(22) 2665-6035",
    waRaw: "5522266560035",
    tom: "tecnico",
    header: "🏪 CASTOR ARARUAMA | Pedro Paulo",
    assinatura: "Pedro Paulo — Castor Araruama",
  },
  {
    email: "entrega@castor.local",
    senha: "ENTREGA",
    nome: "Pedro",
    cargo: "ENTREGA" as Cargo,
    lojaId: 1,
    operacao: "cabo_frio",
    wa: "(22) 99241-0112",
    waRaw: "5522992410112",
    tom: "direto",
    header: "🏪 CASTOR CABO FRIO",
    assinatura: "Castor Cabo Frio",
  },
];

// Seed legado: mantém colaboradoresTable compatível com código antigo
const SEED_COLABORADORES = [
  { codigo: "THALLES", nome: "Thalles", papel: "dono", operacao: "cabo_frio", wa: "(22) 99241-0112", waRaw: "5522992410112", tom: "especialista", header: "🛏️ CASTOR CABO FRIO | ThallesZzz", assinatura: "ThallesZzz — Especialista em Sono" },
  { codigo: "CASTOR2", nome: "Administrador", papel: "dono", operacao: "cabo_frio", wa: "(22) 99241-0112", waRaw: "5522992410112", tom: "especialista", header: "🏪 CASTOR CABO FRIO", assinatura: "Castor Cabo Frio" },
  { codigo: "MARCELA", nome: "Marcela Taranto", papel: "vendedor", operacao: "cabo_frio", wa: "(22) 98844-7240", waRaw: "5522988447240", tom: "acolhedor", header: "🏪 CASTOR CABO FRIO | Marcela", assinatura: "Marcela Taranto — Castor Cabo Frio" },
  { codigo: "VAGNER", nome: "Vagner", papel: "vendedor", operacao: "cabo_frio", wa: "(22) 98832-7816", waRaw: "5522988327816", tom: "direto", header: "🏪 CASTOR CABO FRIO | Vagner", assinatura: "Vagner — Castor Cabo Frio" },
  { codigo: "NETE", nome: "Nete Rafaele", papel: "vendedor", operacao: "araruama", lojaId: 2, wa: "(22) 98824-9183", waRaw: "5522988249183", tom: "proximo", header: "💙 CASTOR ARARUAMA | Nete", assinatura: "Nete Rafaele — Castor Araruama" },
  { codigo: "PEDROPAULO", nome: "Pedro Paulo", papel: "vendedor", operacao: "araruama", lojaId: 2, wa: "(22) 2665-6035", waRaw: "5522266560035", tom: "tecnico", header: "🏪 CASTOR ARARUAMA | Pedro Paulo", assinatura: "Pedro Paulo — Castor Araruama" },
  { codigo: "ENTREGA", nome: "Pedro", papel: "entrega", operacao: "cabo_frio", wa: "(22) 99241-0112", waRaw: "5522992410112", tom: "direto", header: "🏪 CASTOR CABO FRIO", assinatura: "Castor Cabo Frio" },
];

export async function seedColaboradores(): Promise<void> {
  try {
    // Seed legado (colaboradoresTable)
    const existingColab = await db
      .select({ id: colaboradoresTable.id })
      .from(colaboradoresTable)
      .limit(1);

    if (existingColab.length === 0) {
      await db.insert(colaboradoresTable).values(SEED_COLABORADORES).onConflictDoNothing();
    }

    for (const [operacao, lojaId] of Object.entries(LOJA_BY_OPERACAO)) {
      await db
        .update(colaboradoresTable)
        .set({ lojaId })
        .where(eq(colaboradoresTable.operacao, operacao));
    }

    // Seed novo: usuariosTable com bcrypt
    const existingUsuarios = await db
      .select({ id: usuariosTable.id })
      .from(usuariosTable)
      .limit(1);

    if (existingUsuarios.length === 0) {
      for (const u of SEED_USUARIOS) {
        const senhaHash = await bcrypt.hash(u.senha, 10);
        await db
          .insert(usuariosTable)
          .values({
            email: u.email,
            senhaHash,
            nome: u.nome,
            cargo: u.cargo,
            lojaId: u.lojaId,
            operacao: u.operacao,
            wa: u.wa,
            waRaw: u.waRaw,
            tom: u.tom,
            header: u.header,
            assinatura: u.assinatura,
          })
          .onConflictDoNothing();
      }
      console.log("[Sessions] Usuários seedados com bcrypt.");
    }
  } catch (err) {
    console.error("[Sessions] Erro ao seedar:", err);
  }
}

// ─── Session management ───────────────────────────────────────────────────────

function buildSession(token: string, usuario: typeof usuariosTable.$inferSelect): Session {
  return {
    token,
    userId: usuario.id,
    nome: usuario.nome,
    cargo: usuario.cargo as Cargo,
    papel: CARGO_TO_PAPEL[usuario.cargo] ?? "vendedor",
    operacao: usuario.operacao,
    lojaId: usuario.lojaId ?? LOJA_BY_OPERACAO[usuario.operacao] ?? 1,
    wa: usuario.wa ?? "",
    waRaw: usuario.waRaw ?? "",
    tom: usuario.tom ?? "direto",
    header: usuario.header ?? "",
    assinatura: usuario.assinatura ?? "",
    criadoEm: Date.now(),
  };
}

export async function createSessionByEmail(
  email: string,
  senha: string,
  ip?: string,
): Promise<Session | null> {
  const [usuario] = await db
    .select()
    .from(usuariosTable)
    .where(eq(usuariosTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!usuario || !usuario.ativo || !usuario.senhaHash) return null;

  const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaCorreta) return null;

  await updateUltimoLogin(usuario.id);
  await registrarAudit({ lojaId: usuario.lojaId, usuarioId: usuario.id, acao: "LOGIN", ip });

  const token = crypto.randomBytes(32).toString("hex");
  const session = buildSession(token, usuario);
  sessions.set(token, session);
  return session;
}

/** @deprecated Compatibilidade: login pelo código do colaborador legado */
export async function createSession(code: string): Promise<Session | null> {
  const normalizado = code.trim().toUpperCase();

  const [colaborador] = await db
    .select()
    .from(colaboradoresTable)
    .where(eq(colaboradoresTable.codigo, normalizado))
    .limit(1);

  if (!colaborador || !colaborador.ativo) return null;

  await db
    .update(colaboradoresTable)
    .set({ ultimoAcesso: new Date() })
    .where(eq(colaboradoresTable.id, colaborador.id));

  const cargo = ({
    dono: "ADMIN",
    vendedor: "VENDEDOR",
    financeiro: "FINANCEIRO",
    entrega: "ENTREGA",
  }[colaborador.papel] ?? "VENDEDOR") as Cargo;

  const token = crypto.randomBytes(32).toString("hex");
  const session: Session = {
    token,
    userId: -colaborador.id,
    nome: colaborador.nome,
    cargo,
    papel: colaborador.papel,
    operacao: colaborador.operacao,
    lojaId: colaborador.lojaId ?? LOJA_BY_OPERACAO[colaborador.operacao] ?? 1,
    wa: colaborador.wa ?? "",
    waRaw: colaborador.waRaw ?? "",
    tom: colaborador.tom ?? "direto",
    header: colaborador.header ?? "",
    assinatura: colaborador.assinatura ?? "",
    criadoEm: Date.now(),
  };
  sessions.set(token, session);
  return session;
}

export function getSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.criadoEm > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export function getAllUserSessions(userId: number): string[] {
  const tokens: string[] = [];
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) tokens.push(token);
  }
  return tokens;
}

export function destroyAllUserSessions(userId: number): void {
  for (const token of getAllUserSessions(userId)) {
    sessions.delete(token);
  }
}

export function isDono(session: Session): boolean {
  return session.papel === "dono" || session.cargo === "ADMIN" || session.cargo === "GERENTE";
}
