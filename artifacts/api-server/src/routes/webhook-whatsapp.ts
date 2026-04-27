import { Router } from "express";
import { orquestrarMensagem } from "../core/orchestrator.js";
import type { TenantRequest } from "../middleware/tenant.js";

const router = Router();

router.post("/", async (req: TenantRequest, res) => {
  const { message, phone } = req.body as { message?: string; phone?: string };

  if (!message || !phone) {
    res.status(400).json({ erro: "Campos 'message' e 'phone' são obrigatórios" });
    return;
  }

  // Responde imediatamente — processamento assíncrono
  res.sendStatus(200);

  try {
    await orquestrarMensagem({
      mensagem: message,
      telefone: phone,
      tenant: req.tenant,
    });
  } catch (err) {
    console.error("[Webhook] Erro ao orquestrar mensagem:", err);
  }
});

export default router;
