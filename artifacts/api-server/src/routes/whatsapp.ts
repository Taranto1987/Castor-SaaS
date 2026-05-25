import { Router } from "express";
import type { Request, Response } from "express";
import { db, lojasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSession, isDono } from "../lib/sessions";
import {
  createInstance,
  getQRCode,
  getConnectionState,
  deleteInstance,
} from "../services/whatsapp/evolution-client";
import {
  getOrCreateInstance,
  updateStatus,
  getInstanceByLojaId,
} from "../services/whatsapp/instance-manager";
import { logger } from "../lib/logger";
import type { Session } from "../lib/sessions";

const router = Router();

function requireDono(req: Request, res: Response): Session | null {
  const token = (req.headers["x-session-token"] ?? "") as string;
  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão inválida" });
    return null;
  }
  if (!isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao dono" });
    return null;
  }
  return session;
}

async function getLojaSlug(lojaId: number): Promise<string | null> {
  const rows = await db
    .select({ slug: lojasTable.slug })
    .from(lojasTable)
    .where(eq(lojasTable.id, lojaId))
    .limit(1);
  return rows[0]?.slug ?? null;
}

// POST /api/whatsapp/connect — start connection, return QR code
router.post("/connect", async (req: Request, res: Response) => {
  const session = requireDono(req, res);
  if (!session) return;

  const { lojaId } = session;
  const slug = await getLojaSlug(lojaId);
  if (!slug) {
    res.status(404).json({ error: "Loja não encontrada" });
    return;
  }

  const instance = await getOrCreateInstance(lojaId, slug);
  const { instanceId } = instance;

  try {
    await createInstance(instanceId);
  } catch (err) {
    // May already exist on Evolution side — non-fatal
    logger.warn({ err, instanceId }, "createInstance warning");
  }

  try {
    const qrcode = await getQRCode(instanceId);
    await updateStatus(instanceId, "awaiting_qr");
    res.json({ qrcode, instanceId, status: "awaiting_qr" });
  } catch (err) {
    logger.error({ err, instanceId }, "Failed to get QR code");
    res.status(500).json({ error: "Falha ao gerar QR Code" });
  }
});

// GET /api/whatsapp/status — returns DB status, polls Evolution if active
router.get("/status", async (req: Request, res: Response) => {
  const session = requireDono(req, res);
  if (!session) return;

  const { lojaId } = session;
  const slug = await getLojaSlug(lojaId);
  if (!slug) {
    res.status(404).json({ error: "Loja não encontrada" });
    return;
  }

  const instance = await getOrCreateInstance(lojaId, slug);

  if (instance.status !== "disconnected") {
    try {
      const state = await getConnectionState(instance.instanceId);
      if (state === "open" && instance.status !== "connected") {
        await updateStatus(instance.instanceId, "connected");
        res.json({ ...instance, status: "connected" });
        return;
      }
      if (state !== "open" && instance.status === "connected") {
        await updateStatus(instance.instanceId, "reconnect_required");
        res.json({ ...instance, status: "reconnect_required" });
        return;
      }
    } catch {
      // Evolution unreachable — return DB state as-is
    }
  }

  res.json(instance);
});

// DELETE /api/whatsapp/disconnect — disconnect and reset to disconnected
router.delete("/disconnect", async (req: Request, res: Response) => {
  const session = requireDono(req, res);
  if (!session) return;

  const { lojaId } = session;
  const slug = await getLojaSlug(lojaId);
  if (!slug) {
    res.status(404).json({ error: "Loja não encontrada" });
    return;
  }

  const instance = await getInstanceByLojaId(lojaId);
  if (!instance) {
    res.json({ ok: true });
    return;
  }

  try {
    await deleteInstance(instance.instanceId);
  } catch (err) {
    logger.warn({ err, instanceId: instance.instanceId }, "deleteInstance warning");
  }

  await updateStatus(instance.instanceId, "disconnected");
  res.json({ ok: true });
});

// POST /api/whatsapp/webhook — Evolution API webhooks (connection.update, qrcode.updated)
router.post("/webhook", async (req: Request, res: Response) => {
  const payload = req.body as {
    event?: string;
    instance?: string;
    data?: {
      state?: string;
      qrcode?: { base64?: string };
      number?: string;
    };
  };

  const { event, instance: instanceName, data } = payload;
  logger.info({ event, instanceName }, "evolution webhook");

  if (!instanceName) {
    res.json({ ok: true });
    return;
  }

  try {
    if (event === "connection.update") {
      const state = data?.state;
      if (state === "open") {
        await updateStatus(instanceName, "connected", data?.number);
      } else if (state === "close" || state === "connecting") {
        await updateStatus(instanceName, "reconnect_required");
      }
    }
  } catch (err) {
    logger.error({ err, event, instanceName }, "webhook processing error");
  }

  res.json({ ok: true });
});

export default router;
