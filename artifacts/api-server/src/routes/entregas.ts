import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { entregasTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "../lib/sessions";
import type { TenantRequest } from "../middleware/tenant.js";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Autenticação necessária" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  (req as any).session = session;
  next();
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const tenant = (req as TenantRequest).tenant ?? "default";
    const { vendedor, papel } = req.query as { vendedor?: string; papel?: string };

    const allEntregas = await db
      .select()
      .from(entregasTable)
      .where(eq(entregasTable.tenantId, tenant))
      .orderBy(desc(entregasTable.criadoEm));

    if (vendedor && papel === "vendedor") {
      res.json(allEntregas.filter(e => e.vendedor === vendedor));
    } else {
      res.json(allEntregas);
    }
  } catch (error) {
    console.error("Erro ao listar entregas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  try {
    const tenant = (req as TenantRequest).tenant ?? "default";
    const { orcamentoId, cliente, whatsapp, endereco, produtos, vendedor, observacoes, dataEntrega } = req.body;
    if (!cliente) {
      res.status(400).json({ error: "Cliente é obrigatório" });
      return;
    }
    const inserted = await db.insert(entregasTable).values({
      tenantId: tenant,
      orcamentoId: orcamentoId || null,
      cliente,
      whatsapp: whatsapp || null,
      endereco: endereco || null,
      produtos: produtos || null,
      status: "pendente",
      vendedor: vendedor || null,
      observacoes: observacoes || null,
      dataEntrega: dataEntrega || null,
    }).returning();
    res.json(inserted[0]);
  } catch (error) {
    console.error("Erro ao criar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const tenant = (req as unknown as TenantRequest).tenant ?? "default";
    const id = parseInt(req.params.id as string);
    const { status } = req.body;
    const validos = ["pendente", "em_rota", "entregue", "cancelado"];
    if (!validos.includes(status)) {
      res.status(400).json({ error: "Status inválido" });
      return;
    }
    const updated = await db.update(entregasTable)
      .set({ status, atualizadoEm: new Date() })
      .where(and(eq(entregasTable.id, id), eq(entregasTable.tenantId, tenant)))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Entrega não encontrada" });
      return;
    }
    res.json(updated[0]);
  } catch (error) {
    console.error("Erro ao atualizar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const tenant = (req as unknown as TenantRequest).tenant ?? "default";
    const id = parseInt(req.params.id as string);
    const { endereco, observacoes, dataEntrega, vendedor } = req.body;
    const updated = await db.update(entregasTable)
      .set({ endereco, observacoes, dataEntrega, vendedor, atualizadoEm: new Date() })
      .where(and(eq(entregasTable.id, id), eq(entregasTable.tenantId, tenant)))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ error: "Entrega não encontrada" });
      return;
    }
    res.json(updated[0]);
  } catch (error) {
    console.error("Erro ao editar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const tenant = (req as unknown as TenantRequest).tenant ?? "default";
    const id = parseInt(req.params.id as string);
    await db.delete(entregasTable)
      .where(and(eq(entregasTable.id, id), eq(entregasTable.tenantId, tenant)));
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao deletar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
