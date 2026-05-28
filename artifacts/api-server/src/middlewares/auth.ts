import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { getSession, isDono, type Session } from "../lib/sessions";

let VALID_LOJA_IDS = new Set<number>([1, 2]);

export async function refreshLojaRegistry(): Promise<void> {
  try {
    const rows = await db.select({ id: lojasTable.id }).from(lojasTable)
      .where(eq(lojasTable.ativa, true));
    VALID_LOJA_IDS = new Set(rows.map(r => r.id));
  } catch {
    // keep existing set on DB failure
  }
}

function parseLojaHeader(header: string | string[] | undefined): number | null {
  if (!header) return null;
  const id = parseInt(String(header), 10);
  if (!isNaN(id) && id > 0 && VALID_LOJA_IDS.has(id)) return id;
  return null;
}

/** For public routes: validates x-loja-id header against the active-loja whitelist. */
export function resolvePublicLojaId(req: Request): number {
  return parseLojaHeader(req.headers["x-loja-id"]) ?? 1;
}

/** For authenticated routes: extracts lojaId from the session token (rejects if no valid session). */
export function sessionLojaId(req: Request): number {
  const token = (req.headers["x-session-token"] || "") as string;
  const session = token ? getSession(token) : null;
  if (!session) throw new Error("session.lojaId missing — requireAuth must run first");
  return session.lojaId;
}

/** Resolve lojaId from session → validated x-loja-id header → default 1 (Cabo Frio). */
export function resolveLojaId(req: Request): number {
  const token = (req.headers["x-session-token"] || "") as string;
  if (token) {
    const session = getSession(token);
    if (session) return session.lojaId;
  }
  return parseLojaHeader(req.headers["x-loja-id"]) ?? 1;
}

export interface AuthRequest extends Request {
  session?: Session;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return;
  }
  req.session = session;
  next();
}

export function requireDono(req: AuthRequest, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) {
    res.status(401).json({ error: "Sessão não encontrada" });
    return;
  }
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return;
  }
  if (!isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao dono" });
    return;
  }
  req.session = session;
  next();
}
