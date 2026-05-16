import { Router, type Request, type Response } from "express";
import {
  createCastorSession,
  sendCastorMessage,
  streamCastorEvents,
} from "../lib/castor-agent";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/agent/run", requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, session_id } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "message obrigatório" });
    }

    const sessionId = session_id?.startsWith("sesn_")
      ? session_id
      : (await createCastorSession()).id;

    await sendCastorMessage(sessionId, message);

    let text = "";
    let status = "running";
    const stream = await streamCastorEvents(sessionId);

    for await (const event of stream) {
      if (event?.type === "agent.message") {
        for (const block of (event.content ?? [])) {
          if (block?.type === "text") text += block.text;
        }
      }
      if (event?.type === "session.status_idle") { status = "idle"; break; }
      if (event?.type === "session.status_terminated") { status = "terminated"; break; }
    }

    return res.json({
      success: true,
      data: { session_id: sessionId, output: text.trim(), status },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err instanceof Error ? err.message : "Erro" });
  }
});

router.post("/agent/stream", requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, session_id } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ success: false, error: "message obrigatório" });
      return;
    }

    const sessionId = session_id?.startsWith("sesn_")
      ? session_id
      : (await createCastorSession()).id;

    await sendCastorMessage(sessionId, message);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = await streamCastorEvents(sessionId);

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      (stream as any).controller?.abort();
    });

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (
        event?.type === "session.status_idle" ||
        event?.type === "session.status_terminated"
      ) {
        break;
      }
    }

    clearInterval(heartbeat);
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : "Erro" })}\n\n`);
    res.end();
  }
});

export default router;
