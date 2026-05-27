import type { Request, Response, NextFunction } from "express";
import { getSession, isDono, type Session } from "../lib/sessions";
import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// Live set of active loja IDs, refreshed every 5 min from DB.
// Bootstrapped with known IDs to allow startup before first DB round-trip.
let VALID_LOJA_IDS = new Set<number>([1, 2]);

export async function refreshLojaRegistry(): Promise<void> {
  const rows = await db.select({ id: lojasTable.id }).from(lojasTable).where(eq(lojasTable.ativa, true));
  VALID_LOJA_IDS = new Set(rows.map((r) => r.id));
}

/**
 * Structurally validates a lojaId against the live registry.
 */
export function isValidLojaId(id: number): boolean {
  return Number.isInteger(id) && id > 0 && VALID_LOJA_IDS.has(id);
}

/** Resolve lojaId for public routes: x-loja-id header → default 1 (Cabo Frio). */
export function resolvePublicLojaId(req: Request): number {
  const header = req.headers["x-loja-id"];
  if (header) {
    const id = parseInt(String(header), 10);
    if (!isNaN(id) && id > 0 && VALID_LOJA_IDS.has(id)) return id;
  }
  return 1;
}

/** Resolve lojaId from session → x-loja-id header → default 1 (Cabo Frio). */
export function resolveLojaId(req: Request): number {
  const token = (req.headers["x-session-token"] || "") as string;
  if (token) {
    const session = getSession(token);
    if (session) return session.lojaId;
  }
  const header = req.headers["x-loja-id"];
  if (header) {
    const id = parseInt(String(header), 10);
    if (!isNaN(id) && id > 0) return id;
  }
  return 1;
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
