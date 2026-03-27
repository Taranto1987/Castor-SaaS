import crypto from "crypto";

interface Session {
  token: string;
  nome: string;
  papel: string;
  criadoEm: number;
}

const COLABORADORES: Record<string, { nome: string; papel: string }> = {
  THALLES:    { nome: "Thalles",       papel: "dono" },
  CASTOR2:    { nome: "Administrador", papel: "dono" },
  MARCELA:    { nome: "Marcela",       papel: "vendedor" },
  VAGNER:     { nome: "Vagner",        papel: "vendedor" },
  NETE:       { nome: "Nete",          papel: "vendedor" },
  PEDROPAULO: { nome: "Pedro Paulo",   papel: "vendedor" },
  ENTREGA:    { nome: "Pedro",         papel: "entrega" },
};

const sessions = new Map<string, Session>();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function createSession(code: string): Session | null {
  const normalizado = code.trim().toUpperCase();
  const colab = COLABORADORES[normalizado];
  if (!colab) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const session: Session = {
    token,
    nome: colab.nome,
    papel: colab.papel,
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
