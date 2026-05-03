import { Router, type Request, type Response } from "express";
import { runCastorAgent, runOnExistingSession } from "../lib/castor-agent";

const router = Router();

router.post("/agent/run", async (req: Request, res: Response) => {
  try {
    const { message, session_id } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "message obrigatório" });
    }
    const result = session_id?.startsWith("sesn_")
      ? await runOnExistingSession(session_id, message)
      : await runCastorAgent(message);

    return res.json({ success: true, data: { session_id: result.sessionId, output: result.text, status: result.status } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Erro" });
  }
});

export default router;
