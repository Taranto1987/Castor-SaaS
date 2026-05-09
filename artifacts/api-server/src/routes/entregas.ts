import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { entregasTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { resolveLojaId } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { vendedor, papel } = req.query as { vendedor?: string; papel?: string };
    const lojaId = resolveLojaId(req);
    const query = db.select().from(entregasTable)
      .where(eq(entregasTable.lojaId, lojaId))
      .orderBy(desc(entregasTable.criadoEm));
    const all = await query;
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

router.post("/", async (req, res) => {
  try {
    const { orcamentoId, cliente, whatsapp, endereco, produtos, vendedor, observacoes, dataEntrega } = req.body;
    if (!cliente) { res.status(400).json({ error: "Cliente é obrigatório" }); return; }
    const lojaId = resolveLojaId(req);
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

router.patch("/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const validos = ["pendente", "em_rota", "entregue", "cancelado"];
    if (!validos.includes(status)) { res.status(400).json({ error: "Status inválido" }); return; }
    const updated = await db.update(entregasTable)
      .set({ status, atualizadoEm: new Date() })
      .where(eq(entregasTable.id, id))
      .returning();
    if (updated.length === 0) { res.status(404).json({ error: "Entrega não encontrada" }); return; }
    res.json(updated[0]);
  } catch (error) {
    console.error("Erro ao atualizar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { endereco, observacoes, dataEntrega, vendedor } = req.body;
    const updated = await db.update(entregasTable)
      .set({ endereco, observacoes, dataEntrega, vendedor, atualizadoEm: new Date() })
      .where(eq(entregasTable.id, id))
      .returning();
    if (updated.length === 0) { res.status(404).json({ error: "Entrega não encontrada" }); return; }
    res.json(updated[0]);
  } catch (error) {
    console.error("Erro ao editar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(entregasTable).where(eq(entregasTable.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao deletar entrega:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
