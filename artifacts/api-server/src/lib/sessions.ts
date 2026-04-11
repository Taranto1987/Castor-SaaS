import crypto from "crypto";
import { db } from "@workspace/db";
import { colaboradoresTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface Session {
  token: string;
  nome: string;
  papel: string;
  operacao: string;
  wa: string;
  waRaw: string;
  tom: string;
  header: string;
  assinatura: string;
  criadoEm: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ── Seed histórico: migra hardcoded para DB na primeira execução ─────────────
const SEED_USERS = [
  {
    codigo: "THALLES",
    nome: "Thalles",
    papel: "dono",
    operacao: "cabo_frio",
    wa: "(22) 99241-0112",
    waRaw: "5522992410112",
    tom: "especialista",
    header: "🛏️ CASTOR CABO FRIO | ThallesZzz",
    assinatura: "ThallesZzz — Especialista em Sono",
  },
  {
    codigo: "CASTOR2",
    nome: "Administrador",
    papel: "dono",
    operacao: "cabo_frio",
    wa: "(22) 99241-0112",
    waRaw: "5522992410112",
    tom: "especialista",
    header: "🏪 CASTOR CABO FRIO",
    assinatura: "Castor Cabo Frio",
  },
  {
    codigo: "MARCELA",
    nome: "Marcela Taranto",
    papel: "vendedor",
    operacao: "cabo_frio",
    wa: "(22) 98844-7240",
    waRaw: "5522988447240",
    tom: "acolhedor",
    header: "🏪 CASTOR CABO FRIO | Marcela",
    assinatura: "Marcela Taranto — Castor Cabo Frio",
  },
  {
    codigo: "VAGNER",
    nome: "Vagner",
    papel: "vendedor",
    operacao: "cabo_frio",
    wa: "(22) 98832-7816",
    waRaw: "5522988327816",
    tom: "direto",
    header: "🏪 CASTOR CABO FRIO | Vagner",
    assinatura: "Vagner — Castor Cabo Frio",
  },
  {
    codigo: "NETE",
    nome: "Nete Rafaele",
    papel: "vendedor",
    operacao: "araruama",
    wa: "(22) 98824-9183",
    waRaw: "5522988249183",
    tom: "proximo",
    header: "💙 CASTOR ARARUAMA | Nete",
    assinatura: "Nete Rafaele — Castor Araruama",
  },
  {
    codigo: "PEDROPAULO",
    nome: "Pedro Paulo",
    papel: "vendedor",
    operacao: "araruama",
    wa: "(22) 2665-6035",
    waRaw: "5522266560035",
    tom: "tecnico",
    header: "🏪 CASTOR ARARUAMA | Pedro Paulo",
    assinatura: "Pedro Paulo — Castor Araruama",
  },
  {
    codigo: "ENTREGA",
    nome: "Pedro",
    papel: "entrega",
    operacao: "cabo_frio",
    wa: "(22) 99241-0112",
    waRaw: "5522992410112",
    tom: "direto",
    header: "🏪 CASTOR CABO FRIO",
    assinatura: "Castor Cabo Frio",
  },
];

export async function seedColaboradores(): Promise<void> {
  try {
    const existing = await db
      .select({ id: colaboradoresTable.id })
      .from(colaboradoresTable)
      .limit(1);

    if (existing.length > 0) return; // Já populado

    await db.insert(colaboradoresTable).values(SEED_USERS).onConflictDoNothing();
    console.log("[Sessions] Colaboradores seedados no banco de dados.");
  } catch (err) {
    console.error("[Sessions] Erro ao seedar colaboradores:", err);
  }
}

// ── Session management ────────────────────────────────────────────────────────

export async function createSession(code: string): Promise<Session | null> {
  const normalizado = code.trim().toUpperCase();

  const [colaborador] = await db
    .select()
    .from(colaboradoresTable)
    .where(eq(colaboradoresTable.codigo, normalizado))
    .limit(1);

  if (!colaborador || !colaborador.ativo) return null;

  // Registra último acesso
  await db
    .update(colaboradoresTable)
    .set({ ultimoAcesso: new Date() })
    .where(eq(colaboradoresTable.id, colaborador.id));

  const token = crypto.randomBytes(32).toString("hex");
  const session: Session = {
    token,
    nome: colaborador.nome,
    papel: colaborador.papel,
    operacao: colaborador.operacao,
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

export function isDono(session: Session): boolean {
  return session.papel === "dono";
}
