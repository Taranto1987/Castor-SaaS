import { Router } from "express";
import { resolveLojaId } from "../middlewares/auth";
import { requireFinanceiro } from "../lib/rbac";
// requireDono alias → requireFinanceiro: ADMIN+GERENTE+FINANCEIRO acessam módulo financeiro
const requireDono = requireFinanceiro;
import {
  findDespesas,
  createDespesa,
  updateDespesa,
  deleteDespesa,
  updateDespesaComprovante,
  findDespesasRecorrentes,
  createDespesaRecorrente,
  disableDespesaRecorrente,
  findDespesasRecorrentesNoMes,
  findComissoesConfig,
  upsertComissaoConfig,
  upsertMeta,
  findMeta,
} from "../services/finance/repository";
import {
  calcularDRE,
  calcularComissoes,
  calcularResumoDiario,
  calcularEvolucao,
  calcularAlertas,
} from "../services/finance/dre";
import { CATEGORIAS_DESPESA } from "../services/finance/types";
import { parseMesAno, getMonthRange } from "../services/shared/date";

const router = Router();

router.get("/categorias-despesa", requireDono, (_req, res) => {
  res.json(CATEGORIAS_DESPESA);
});

router.get("/despesas", requireDono, async (req, res) => {
  try {
    const { mes, ano, categoria } = req.query as Record<string, string | undefined>;
    const { mes: m, ano: a } = parseMesAno(mes, ano);
    const { inicio, fim } = getMonthRange(m, a);
    const lojaId = resolveLojaId(req);
    res.json(await findDespesas(inicio, fim, categoria, lojaId));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/despesas", requireDono, async (req, res) => {
  try {
    const { valor, categoria, descricao, comprovante, recorrente, data } = req.body;
    if (!valor || !categoria) { res.status(400).json({ error: "Valor e categoria são obrigatórios" }); return; }
    const lojaId = resolveLojaId(req);
    res.json(await createDespesa({
      lojaId, valor: String(valor), categoria,
      descricao: descricao || null, comprovante: comprovante || null,
      recorrente: recorrente || false, data: data ? new Date(data) : new Date(),
    }));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/despesas/:id", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { valor, categoria, descricao, comprovante, confirmada, data } = req.body;
    const updates: Parameters<typeof updateDespesa>[1] = {};
    if (valor !== undefined) updates.valor = String(valor);
    if (categoria !== undefined) updates.categoria = categoria;
    if (descricao !== undefined) updates.descricao = descricao;
    if (comprovante !== undefined) updates.comprovante = comprovante;
    if (confirmada !== undefined) updates.confirmada = confirmada;
    if (data !== undefined) updates.data = new Date(data);
    const lojaId = resolveLojaId(req);
    const row = await updateDespesa(id, updates, lojaId);
    if (!row) { res.status(404).json({ error: "Despesa não encontrada" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/despesas/:id", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await deleteDespesa(id, resolveLojaId(req));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/despesas/:id/comprovante", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const lojaId = resolveLojaId(req);
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) { res.status(400).json({ error: "Arquivo vazio" }); return; }
      if (buffer.length > 5 * 1024 * 1024) { res.status(400).json({ error: "Arquivo muito grande (max 5MB)" }); return; }
      const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      const row = await updateDespesaComprovante(id, base64, lojaId);
      if (!row) { res.status(404).json({ error: "Despesa não encontrada" }); return; }
      res.json({ id: row.id, comprovante: "uploaded" });
    });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/despesas-recorrentes", requireDono, async (req, res) => {
  try { res.json(await findDespesasRecorrentes(resolveLojaId(req))); }
  catch { res.status(500).json({ error: "Erro interno" }); }
});

router.post("/despesas-recorrentes", requireDono, async (req, res) => {
  try {
    const { valor, categoria, descricao, diaVencimento } = req.body;
    if (!valor || !categoria) { res.status(400).json({ error: "Valor e categoria são obrigatórios" }); return; }
    const lojaId = resolveLojaId(req);
    res.json(await createDespesaRecorrente({ lojaId, valor: String(valor), categoria, descricao: descricao || null, diaVencimento: diaVencimento || 1 }));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/despesas-recorrentes/:id", requireDono, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await disableDespesaRecorrente(id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/gerar-recorrentes", requireDono, async (req, res) => {
  try {
    const { mes, ano } = req.body;
    const now = new Date();
    const m = mes || now.getMonth() + 1;
    const a = ano || now.getFullYear();
    const lojaId = resolveLojaId(req);
    const { inicio, fim } = getMonthRange(m, a);
    const recorrentes = await findDespesasRecorrentes(lojaId);
    const existentes = await findDespesasRecorrentesNoMes(inicio, fim, lojaId);
    const existentesIds = new Set(existentes.map((e) => e.recorrenteId));
    const { createDespesa: createD } = await import("../services/finance/repository");
    let geradas = 0;
    for (const rec of recorrentes) {
      if (existentesIds.has(rec.id)) continue;
      const dia = Math.min(rec.diaVencimento, fim.getDate());
      await createD({
        lojaId,
        valor: rec.valor,
        categoria: rec.categoria,
        descricao: rec.descricao,
        recorrente: true,
        data: new Date(a, m - 1, dia),
      });
      geradas++;
    }
    res.json({ geradas });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/comissoes", requireDono, async (req, res) => {
  try {
    const { mes, ano } = req.query as Record<string, string | undefined>;
    const { mes: m, ano: a } = parseMesAno(mes, ano);
    res.json(await calcularComissoes(m, a, resolveLojaId(req)));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/comissoes-config", requireDono, async (req, res) => {
  try { res.json(await findComissoesConfig(resolveLojaId(req))); }
  catch { res.status(500).json({ error: "Erro interno" }); }
});

router.post("/comissoes-config", requireDono, async (req, res) => {
  try {
    const { vendedor, percentual } = req.body;
    if (!vendedor || percentual === undefined) { res.status(400).json({ error: "Dados incompletos" }); return; }
    res.json(await upsertComissaoConfig(vendedor, String(percentual), resolveLojaId(req)));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/dre", requireDono, async (req, res) => {
  try {
    const { mes, ano } = req.query as Record<string, string | undefined>;
    const { mes: m, ano: a } = parseMesAno(mes, ano);
    res.json(await calcularDRE(m, a, resolveLojaId(req)));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/resumo-diario", requireDono, async (req, res) => {
  try { res.json(await calcularResumoDiario(resolveLojaId(req))); }
  catch { res.status(500).json({ error: "Erro interno" }); }
});

router.get("/metas", async (req, res) => {
  try {
    const { mes, ano, operacao } = req.query as Record<string, string | undefined>;
    const { mes: m, ano: a } = parseMesAno(mes, ano);
    res.json(await findMeta(m, a, operacao || "cabo_frio"));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/metas", requireDono, async (req, res) => {
  try {
    const { mes, ano, valor, operacao } = req.body;
    const now = new Date();
    const m = mes || now.getMonth() + 1;
    const a = ano || now.getFullYear();
    if (!valor || parseFloat(valor) <= 0) { res.status(400).json({ error: "Valor inválido" }); return; }
    res.json(await upsertMeta(m, a, String(valor), operacao || "cabo_frio"));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/alertas", requireDono, async (req, res) => {
  try {
    const { operacao } = req.query as Record<string, string | undefined>;
    res.json(await calcularAlertas(operacao || "cabo_frio", resolveLojaId(req)));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/evolucao", requireDono, async (req, res) => {
  try {
    const { meses: mesesParam } = req.query as Record<string, string | undefined>;
    const qtd = Math.min(parseInt(mesesParam || "6"), 12);
    res.json(await calcularEvolucao(qtd, resolveLojaId(req)));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
