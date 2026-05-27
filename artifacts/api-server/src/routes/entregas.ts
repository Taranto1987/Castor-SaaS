import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { entregasTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { vendedor, papel } = req.query as { vendedor?: string; papel?: string };
    const lojaId = req.session!.lojaId;
    const all = await db
      .select()
      .from(entregasTable)
      .where(eq(entregasTable.lojaId, lojaId))
      .orderBy(desc(entregasTable.criadoEm));
    if (vendedor && papel === "vendedor") {
      res.json(all.filter(e => e.vendedor === vendedor));
    } else {
      res.json(all);
    }
  } catch (error) {
    console.error("Erro ao listar entregas:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { orcamentoId, cliente, whatsapp, endereco, produtos, vendedor, observacoes, dataEntrega } = req.body;
    if (!cliente) { res.status(400).json({ error: "Cliente é obrigatório" }); return; }
    const lojaId = req.session!.lojaId;
    const inserted = await db.insert(entregasTable).values({
      lojaId,
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

router.patch("/:id/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const lojaId = req.session!.lojaId;
    const { status } = req.body;
    const validos = ["pendente", "em_rota", "entregue", "cancelado"];
    if (!validos.includes(status)) { res.status(400).json({ error: "Status inválido" }); return; }
    const updated = await db
      .update(entregasTable)
      .set({ status, atualizadoEm: new Date() })
      .where(and(eq(entregasTable.id, id), eq(entregasTable.lojaId, lojaId)))
      .returning();
    if (updated.length === 0) { res.status(404).json({ error: "Entrega não encontrada" }); return; }
    res.json(updated[0]);
  } catch (error) {
    console.error("Erro ao atualizar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const lojaId = req.session!.lojaId;
    const { endereco, observacoes, dataEntrega, vendedor } = req.body;
    const updated = await db
      .update(entregasTable)
      .set({ endereco, observacoes, dataEntrega, vendedor, atualizadoEm: new Date() })
      .where(and(eq(entregasTable.id, id), eq(entregasTable.lojaId, lojaId)))
      .returning();
    if (updated.length === 0) { res.status(404).json({ error: "Entrega não encontrada" }); return; }
    res.json(updated[0]);
  } catch (error) {
    console.error("Erro ao editar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const lojaId = req.session!.lojaId;
    const deleted = await db
      .delete(entregasTable)
      .where(and(eq(entregasTable.id, id), eq(entregasTable.lojaId, lojaId)))
      .returning({ id: entregasTable.id });
    if (deleted.length === 0) { res.status(404).json({ error: "Entrega não encontrada" }); return; }
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao deletar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
