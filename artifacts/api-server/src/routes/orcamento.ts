import { Router } from "express";
import { requireAuth, resolveLojaId } from "../middlewares/auth";
import { findProdutosByIds, saveOrcamento, findHistorico, findOrcamentoById, fecharVendaTransaction } from "../services/orcamento/repository";
import { gerarTextoOrcamento } from "../services/orcamento/generator";
import type { AuthRequest } from "../middlewares/auth";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { cliente, whatsapp, produtoIds, observacoes, descontoPix = 0 } = req.body;
    if (!cliente || !produtoIds || !Array.isArray(produtoIds) || produtoIds.length === 0) {
      res.status(400).json({ error: "Cliente e pelo menos um produto são obrigatórios" });
      return;
    }
    const lojaId = resolveLojaId(req);
    const ids = produtoIds.map((id: unknown) => parseInt(String(id)));
    const results = await findProdutosByIds(ids, lojaId);
    if (results.length === 0) { res.status(404).json({ error: "Nenhum produto encontrado" }); return; }
    const ordenados = ids.map((id) => results.find((p) => p.id === id)).filter(Boolean) as typeof results;

    const session = (req as AuthRequest).session;
    const generated = gerarTextoOrcamento(
      { cliente, whatsapp, produtoIds: ids, observacoes, descontoPix, vendedor: session?.nome, header: session?.header, wa: session?.wa },
      ordenados
    );
    res.json(generated);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/salvar", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { cliente, whatsapp, produtosJson, observacoes, descontoPix, totalPix, totalPrazo, texto, vendedor, precoBaseTotal, descontoAplicado } = req.body;
    if (!cliente || !texto) { res.status(400).json({ error: "Dados insuficientes para salvar" }); return; }
    const lojaId = req.session?.lojaId ?? resolveLojaId(req);
    const row = await saveOrcamento({ lojaId, cliente, whatsapp, produtosJson, observacoes, descontoPix, totalPix, totalPrazo, texto, vendedor, precoBaseTotal, descontoAplicado });
    res.json({ id: row.id, mensagem: "Orçamento salvo com sucesso!" });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/historico", requireAuth, async (req: AuthRequest, res) => {
  try {
    const session = req.session!;
    const page = Math.max(0, parseInt(String(req.query.page ?? "0")) || 0);
    res.json(await findHistorico(session.papel, session.nome, page, session.lojaId));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/:id/fechar", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!id || isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { endereco, observacoes, dataEntrega } = req.body;

    const orc = await findOrcamentoById(id);
    if (!orc) { res.status(404).json({ error: "Orçamento não encontrado" }); return; }
    if (orc.lojaId !== req.session!.lojaId) { res.status(403).json({ error: "Acesso negado" }); return; }
    if (orc.status === "vendido") { res.status(409).json({ error: "Orçamento já foi fechado como venda" }); return; }

    const entrega = await fecharVendaTransaction(id, orc, { endereco, observacoes, dataEntrega });
    res.json({ mensagem: "Venda fechada! Entrega criada.", entregaId: entrega.id });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
