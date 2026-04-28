import { Router, type IRouter } from "express";
import { executarAgente } from "../services/agente.js";
import type { TenantRequest } from "../middleware/tenant.js";

const router: IRouter = Router();

router.post("/", async (req: TenantRequest, res) => {
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
