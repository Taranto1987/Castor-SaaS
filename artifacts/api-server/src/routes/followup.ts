import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { orcamentosTable } from "@workspace/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { enviarWhatsApp } from "../services/whatsapp.js";
import type { TenantRequest } from "../middleware/tenant.js";

const router: IRouter = Router();

// POST /api/followup/trigger — dispara follow-ups para orçamentos pendentes há mais de 24h
router.post("/trigger", async (req: TenantRequest, res) => {
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
