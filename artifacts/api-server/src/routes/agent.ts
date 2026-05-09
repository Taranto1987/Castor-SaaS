import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { executarAgente } from "../services/agente.js";
import { getSession } from "../lib/sessions.js";
import type { TenantRequest } from "../middleware/tenant.js";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Autenticação necessária" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  next();
}

router.post("/", requireAuth, async (req: TenantRequest, res) => {
  try {
    const { mensagem, contexto, modelo } = req.body as {
      mensagem: string;
      contexto?: Record<string, unknown>;
      modelo?: string;
    };

    if (!mensagem || typeof mensagem !== "string") {
      res.status(400).json({ error: "mensagem é obrigatória" });
      return;
    }

    const resposta = await executarAgente({
      mensagem,
      contexto: contexto ?? {},
      modelo: modelo ?? "claude-haiku-4-5-20251001",
    });

    res.json({ resposta });
  } catch (err) {
    console.error("[Agent] Erro:", err);
    res.status(500).json({ error: "Erro ao processar mensagem" });
  }
});

export default router;
