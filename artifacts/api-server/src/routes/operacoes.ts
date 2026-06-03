import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { listOperacoes } from "../services/operacoes/repository";

const router: IRouter = Router();

/**
 * GET /api/operacoes — Central de Operações (COCA).
 * Returns the actionable board for the caller's loja: headline widgets,
 * the "Ação Agora" cards (top opportunities by score) and the full pipeline.
 */
router.get("/operacoes", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const data = await listOperacoes(lojaId);
    res.json(data);
  } catch (err) {
    console.error("[operacoes] list error:", err);
    res.status(500).json({ error: "Erro ao carregar a Central de Operações" });
  }
});

export default router;
