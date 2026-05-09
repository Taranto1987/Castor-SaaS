import type { Request, Response, NextFunction } from "express";
import { getSession } from "./sessions";
import type { Cargo } from "@workspace/db/schema";

export type { Cargo };

function getSessionFromReq(req: Request) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) return null;
  return getSession(token);
}

/** Middleware: exige que o usuário autenticado tenha um dos cargos listados. */
export function requireCargo(...cargos: Cargo[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = getSessionFromReq(req);
    if (!session) {
      res.status(401).json({ error: "Sessão não encontrada" });
      return;
    }
    if (!cargos.includes(session.cargo as Cargo)) {
      res.status(403).json({ error: "Acesso negado para este cargo" });
      return;
    }
    next();
  };
}

/** Qualquer usuário autenticado (todos os cargos). */
export const requireAuth = requireCargo(
  "ADMIN",
  "GERENTE",
  "VENDEDOR",
  "FINANCEIRO",
  "ENTREGA",
);

/** Admin ou Gerente. */
export const requireGerente = requireCargo("ADMIN", "GERENTE");

/** Admin, Gerente ou Financeiro. */
export const requireFinanceiro = requireCargo("ADMIN", "GERENTE", "FINANCEIRO");

/** Apenas Admin. */
export const requireAdmin = requireCargo("ADMIN");

/** Vendedores + cargos superiores (não Entrega). */
export const requireVendedor = requireCargo("ADMIN", "GERENTE", "VENDEDOR", "FINANCEIRO");
