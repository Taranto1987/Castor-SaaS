import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { followUpsTable, orcamentosTable } from "@workspace/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * GET /api/followup/pendentes
 * Retorna follow-ups automáticos ainda não executados.
 * Dono vê todos; vendedor vê apenas os seus.
 */
router.get("/pendentes", requireAuth, async (req: AuthRequest, res) => {
  try {
    const session = req.session!;

    const rows = await db
      .select({
        id:          followUpsTable.id,
        tipo:        followUpsTable.tipo,
        mensagem:    followUpsTable.mensagem,
        waLink:      followUpsTable.waLink,
        geradoEm:    followUpsTable.geradoEm,
        orcamentoId: followUpsTable.orcamentoId,
        cliente:     orcamentosTable.cliente,
        whatsapp:    orcamentosTable.whatsapp,
        vendedor:    orcamentosTable.vendedor,
        totalPix:    orcamentosTable.totalPix,
        status:      orcamentosTable.status,
      })
      .from(followUpsTable)
      .innerJoin(orcamentosTable, eq(followUpsTable.orcamentoId, orcamentosTable.id))
      .where(
        and(
          eq(followUpsTable.lojaId, session.lojaId),
          isNull(followUpsTable.executadoEm),
          eq(orcamentosTable.status, "pendente")
        )
      )
      .orderBy(desc(followUpsTable.geradoEm));

    const filtered =
      session.papel === "dono"
        ? rows
        : rows.filter((r) => r.vendedor === session.nome || r.vendedor === "ThallesZzz");

    res.json(filtered);
  } catch (error) {
    console.error("[FollowUp] Erro ao buscar pendentes:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

/**
 * POST /api/followup/:id/executado
 * Marca um follow-up como executado (enviado ao cliente).
 */
router.post("/:id/executado", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [updated] = await db
      .update(followUpsTable)
      .set({ executadoEm: new Date() })
      .where(and(eq(followUpsTable.id, id), eq(followUpsTable.lojaId, req.session!.lojaId)))
      .returning({ id: followUpsTable.id });

    if (!updated) {
      res.status(404).json({ error: "Follow-up não encontrado" });
      return;
    }

    res.json({ mensagem: "Follow-up marcado como executado", id: updated.id });
  } catch (error) {
    console.error("[FollowUp] Erro ao marcar executado:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
