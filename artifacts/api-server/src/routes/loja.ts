import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { detectarLoja } from "../services/tenant/geo-routing";
import { TENANT_BY_OPERACAO } from "../services/tenant/context";
import { getSession, isDono } from "../lib/sessions";

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

export interface PricingConfig {
  supplierDiscountPercent: number;
  outletMarkupPercent: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  supplierDiscountPercent: 32.5,
  outletMarkupPercent: 60,
};

export function getPricingConfig(configJson: unknown): PricingConfig {
  const cfg = (configJson as Record<string, number> | null) ?? {};
  return {
    supplierDiscountPercent: cfg.supplierDiscountPercent ?? DEFAULT_PRICING.supplierDiscountPercent,
    outletMarkupPercent: cfg.outletMarkupPercent ?? DEFAULT_PRICING.outletMarkupPercent,
  };
}

export function calcOutletPrice(tablePrice: number, pricing: PricingConfig): {
  factoryCost: number;
  outletPrice: number;
} {
  const factoryCost = tablePrice * (1 - pricing.supplierDiscountPercent / 100);
  const outletPrice = factoryCost * (1 + pricing.outletMarkupPercent / 100);
  return { factoryCost: Math.round(factoryCost * 100) / 100, outletPrice: Math.round(outletPrice * 100) / 100 };
}

/**
 * GET /api/loja/:id/pricing
 * Returns pricing configuration for a loja.
 */
router.get("/loja/:id/pricing", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  try {
    const [loja] = await db.select({ configJson: lojasTable.configJson }).from(lojasTable).where(eq(lojasTable.id, id)).limit(1);
    if (!loja) { res.status(404).json({ error: "Loja não encontrada" }); return; }
    res.json(getPricingConfig(loja.configJson));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/**
 * PATCH /api/loja/:id/pricing
 * Updates pricing configuration. Dono only.
 */
router.patch("/loja/:id/pricing", async (req: Request, res: Response) => {
  const token = (req.headers["x-session-token"] ?? "") as string;
  const session = getSession(token);
  if (!session || !isDono(session)) { res.status(403).json({ error: "Acesso restrito ao dono" }); return; }

  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const { supplierDiscountPercent, outletMarkupPercent } = req.body as Partial<PricingConfig>;
  if (
    (supplierDiscountPercent !== undefined && (typeof supplierDiscountPercent !== "number" || supplierDiscountPercent < 0 || supplierDiscountPercent >= 100)) ||
    (outletMarkupPercent !== undefined && (typeof outletMarkupPercent !== "number" || outletMarkupPercent < 0))
  ) {
    res.status(400).json({ error: "Valores inválidos" }); return;
  }

  try {
    const [loja] = await db.select({ configJson: lojasTable.configJson }).from(lojasTable).where(eq(lojasTable.id, id)).limit(1);
    if (!loja) { res.status(404).json({ error: "Loja não encontrada" }); return; }

    const current = getPricingConfig(loja.configJson);
    const updated: PricingConfig = {
      supplierDiscountPercent: supplierDiscountPercent ?? current.supplierDiscountPercent,
      outletMarkupPercent: outletMarkupPercent ?? current.outletMarkupPercent,
    };

    await db.update(lojasTable)
      .set({ configJson: { ...(loja.configJson as object ?? {}), ...updated } })
      .where(eq(lojasTable.id, id));

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
