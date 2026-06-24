import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { isDono } from "../lib/sessions";
import {
  listLeads, getPipeline, getLeadDetail, createLead, resetLeads,
  updateLead, archiveLead, addInteracao, listInteracoes,
  createTarefa, updateTarefa, ingestMapaSonoLead,
} from "../services/leads";

const router = Router();

router.post("/leads/mapa-sono", async (req, res) => {
  try {
    const result = await ingestMapaSonoLead(req.body ?? {});
    res.status(result.status).json(
      result.success
        ? { success: true, data: result.data }
        : { success: false, error: result.error },
    );
  } catch (err) {
    console.error("[Leads] POST /leads/mapa-sono error:", err);
    res.status(500).json({ success: false, error: "Erro ao salvar lead" });
  }
});

router.get("/leads", requireAuth, async (req: AuthRequest, res) => {
  try {
    const lojaId = req.session!.lojaId;
    const { estagio, vendedor, origem, tag, search } = req.query;
    const leads = await listLeads(lojaId, {
      estagio: estagio as string | undefined,
      vendedor: vendedor as string | undefined,
      origem: origem as string | undefined,
      tag: tag as string | undefined,
      search: search as string | undefined,
    });
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ leads });
  } catch (err) {
    console.error("[Leads] GET /leads error:", err);
    res.status(500).set("Cache-Control", "no-store").json({ error: "Erro ao carregar leads" });
  }
});

router.get("/leads/pipeline", requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json({ pipeline: await getPipeline(req.session!.lojaId) });
  } catch (err) {
    console.error("[Leads] pipeline error:", err);
    res.status(500).json({ error: "Erro ao carregar pipeline" });
  }
});

router.get("/leads/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const detail = await getLeadDetail(id, req.session!.lojaId);
    if (!detail) { res.status(404).json({ error: "Lead não encontrado" }); return; }
    res.json(detail);
  } catch (err) {
    console.error("[Leads] GET /:id error:", err);
    res.status(500).json({ error: "Erro ao carregar lead" });
  }
});

router.post("/leads", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { nome, whatsapp, email, estagio, origem, tags, observacoes, vendedorAtribuido } = req.body;
    if (!nome?.trim()) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
    const lead = await createLead(
      req.session!.lojaId,
      { nome, whatsapp, email, estagio, origem, tags, observacoes, vendedorAtribuido },
      req.session!.nome,
    );
    res.status(201).json({ lead });
  } catch (err) {
    console.error("[Leads] POST /leads error:", err);
    res.status(500).json({ error: "Erro ao criar lead" });
  }
});

router.post("/leads/reset", requireAuth, async (req: AuthRequest, res) => {
  try {
    const session = req.session!;
    if (!isDono(session)) {
      res.status(403).json({ error: "Apenas dono/admin pode resetar o CRM" });
      return;
    }
    const tudo = req.body?.tudo === true;
    const count = await resetLeads(session.lojaId, tudo, session.nome, String(session.userId));
    res.json({ arquivados: count });
  } catch (err) {
    console.error("[Leads] POST /leads/reset error:", err);
    res.status(500).json({ error: "Erro ao resetar CRM" });
  }
});

router.patch("/leads/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const result = await updateLead(id, req.session!.lojaId, req.body, req.session!.nome, String(req.session!.userId));
    if ("error" in result) { res.status(result.status!).json({ error: result.error }); return; }
    res.json({ lead: result.lead });
  } catch (err) {
    console.error("[Leads] PATCH /:id error:", err);
    res.status(500).json({ error: "Erro ao atualizar lead" });
  }
});

router.delete("/leads/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await archiveLead(id, req.session!.lojaId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Leads] DELETE /:id error:", err);
    res.status(500).json({ error: "Erro ao arquivar lead" });
  }
});

router.post("/leads/:id/interacoes", requireAuth, async (req: AuthRequest, res) => {
  try {
    const leadId = parseInt(String(req.params.id), 10);
    const { tipo, conteudo } = req.body;
    if (!conteudo?.trim()) { res.status(400).json({ error: "Conteúdo é obrigatório" }); return; }
    const interacao = await addInteracao(leadId, req.session!.lojaId, { tipo, conteudo }, req.session!.nome, String(req.session!.userId));
    res.status(201).json({ interacao });
  } catch (err) {
    console.error("[Leads] POST interacoes error:", err);
    res.status(500).json({ error: "Erro ao registrar interação" });
  }
});

router.get("/leads/:id/interacoes", requireAuth, async (req: AuthRequest, res) => {
  try {
    const leadId = parseInt(String(req.params.id), 10);
    const interacoes = await listInteracoes(leadId, req.session!.lojaId);
    res.json({ interacoes });
  } catch (err) {
    console.error("[Leads] GET interacoes error:", err);
    res.status(500).json({ error: "Erro ao carregar interações" });
  }
});

router.post("/leads/:id/tarefas", requireAuth, async (req: AuthRequest, res) => {
  try {
    const leadId = parseInt(String(req.params.id), 10);
    const { descricao, tipo, prazo, responsavel } = req.body;
    if (!descricao?.trim()) { res.status(400).json({ error: "Descrição é obrigatória" }); return; }
    const tarefa = await createTarefa(leadId, req.session!.lojaId, { descricao, tipo, prazo, responsavel }, req.session!.nome);
    res.status(201).json({ tarefa });
  } catch (err) {
    console.error("[Leads] POST tarefas error:", err);
    res.status(500).json({ error: "Erro ao criar tarefa" });
  }
});

router.patch("/leads/:id/tarefas/:tid", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tid = parseInt(String(req.params.tid), 10);
    const { concluso, descricao, prazo } = req.body;
    const tarefa = await updateTarefa(tid, req.session!.lojaId, { concluso, descricao, prazo });
    res.json({ tarefa });
  } catch (err) {
    console.error("[Leads] PATCH tarefa error:", err);
    res.status(500).json({ error: "Erro ao atualizar tarefa" });
  }
});

export default router;
