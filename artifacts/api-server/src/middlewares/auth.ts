import type { Request, Response, NextFunction } from "express";
import { getSession, isDono, type Session } from "../lib/sessions";

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
