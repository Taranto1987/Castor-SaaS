import type { Request, Response, NextFunction } from "express";
import { getSession, isDono, type Session } from "../lib/sessions";

/**
 * Structurally validates a lojaId. Phase 3 (write tools) must additionally
 * verify existence in DB and caller authorization for the tenant.
 */
export function isValidLojaId(id: number): boolean {
  return Number.isInteger(id) && id > 0 && id < 100_000;
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
