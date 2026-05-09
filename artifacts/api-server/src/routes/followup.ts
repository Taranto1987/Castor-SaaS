import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { orcamentosTable } from "@workspace/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { enviarWhatsApp } from "../services/whatsapp.js";
import { getSession, isDono } from "../lib/sessions.js";
import type { TenantRequest } from "../middleware/tenant.js";

const router: IRouter = Router();

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Autenticação necessária" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  if (!isDono(session)) { res.status(403).json({ error: "Acesso restrito ao dono" }); return; }
  next();
}

// POST /api/followup/trigger — dispara follow-ups para orçamentos pendentes há mais de 24h
router.post("/trigger", requireDono, async (req: TenantRequest, res) => {
  const tenant = req.tenant ?? "default";
  const limite = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const pendentes = await db
      .select({
        id: orcamentosTable.id,
        cliente: orcamentosTable.cliente,
        whatsapp: orcamentosTable.whatsapp,
      })
      .from(orcamentosTable)
      .where(
        and(
          eq(orcamentosTable.tenantId, tenant),
          eq(orcamentosTable.status, "pendente"),
          lt(orcamentosTable.criadoEm, limite)
        )
      );

    let enviados = 0;
    for (const orc of pendentes) {
      if (!orc.whatsapp) continue;
      try {
        await enviarWhatsApp(
          orc.whatsapp,
          `Olá, ${orc.cliente}! Vi que você ainda não finalizou seu pedido. Posso te ajudar com alguma dúvida? 😊`
        );
        enviados++;
      } catch {
        // best-effort
      }
    }

    res.json({ pendentes: pendentes.length, enviados });
  } catch (err) {
    console.error("[Followup] Erro:", err);
    res.status(500).json({ error: "Erro ao processar follow-ups" });
  }
});

export default router;
