import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { detectarLoja } from "../services/tenant/geo-routing";
import { TENANT_BY_OPERACAO } from "../services/tenant/context";

const router = Router();

/**
 * GET /api/loja/detect?cidade=X&cep=X&operacao=X
 * Returns lojaId and config for a given location.
 * Used by public pages (catalog, chat, LPs) to self-scope to the right tenant.
 */
router.get("/loja/detect", (req: Request, res: Response) => {
  const { cidade, cep, ddd, operacao } = req.query as Record<string, string | undefined>;
  const result = detectarLoja({ cidade, cep, ddd, operacao });
  const config = TENANT_BY_OPERACAO[result.operacao];
  res.json({
    lojaId: result.lojaId,
    operacao: result.operacao,
    confianca: result.confianca,
    contato: config?.contato ?? null,
    whatsappNumero: config?.whatsappNumero ?? null,
    whatsappDisplay: config?.whatsappDisplay ?? null,
    cidade: config?.cidade ?? null,
  });
});

/**
 * GET /api/loja/:id
 * Returns full config for a loja.
 */
router.get("/loja/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    const [loja] = await db.select().from(lojasTable).where(eq(lojasTable.id, id)).limit(1);
    if (!loja) { res.status(404).json({ error: "Loja não encontrada" }); return; }
    res.json(loja);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/**
 * GET /api/lojas
 * List all active lojas (public).
 */
router.get("/lojas", async (_req: Request, res: Response) => {
  try {
    const lojas = await db
      .select()
      .from(lojasTable)
      .where(eq(lojasTable.ativa, true))
      .orderBy(lojasTable.id);
    res.json(lojas);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
