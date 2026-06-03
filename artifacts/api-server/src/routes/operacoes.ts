import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { listOperacoes, listPipeline } from "../services/operacoes/repository";

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

/**
 * GET /api/operacoes/pipeline — full opportunity pipeline (all statuses) with
 * follow-up counts, for the Histórico → Pipeline view. Scoped to the caller's loja.
 */
router.get("/operacoes/pipeline", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const data = await listPipeline(lojaId);
    res.json(data);
  } catch (err) {
    console.error("[operacoes] pipeline error:", err);
    res.status(500).json({ error: "Erro ao carregar o pipeline" });
  }
});

export default router;
