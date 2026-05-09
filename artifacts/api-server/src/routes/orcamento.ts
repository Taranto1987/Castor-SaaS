import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { produtosTable, orcamentosTable, entregasTable } from "@workspace/db/schema";
import { inArray, desc, eq, and, SQL } from "drizzle-orm";
import { str } from "../utils/params.js";
import { getSession } from "../lib/sessions";
import type { TenantRequest } from "../middleware/tenant.js";
import { TENANTS } from "../config/tenants.js";

function formatarTelefone(raw: string): string {
  if (!raw) return "";
  const num = raw.startsWith("55") ? raw.slice(2) : raw;
  if (num.length === 11) return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7)}`;
  return num;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Autenticação necessária" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  (req as any).session = session;
  next();
}

const router: IRouter = Router();

function parsarPreco(valor?: string | null): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Destaque por categoria — regra do negócio: todo produto tem benefício explícito
const BENEFICIO_CATEGORIA: Record<string, string> = {
  "colchoes":          "🌙 Engenharia do sono — conforto e saúde para sua noite",
  "cama-box":          "🏠 Base de qualidade — sustentação ideal para seu colchão",
  "cama-box-colchao":  "🌙 Conjunto completo — colchão + base em uma só compra",
  "travesseiros":      "💤 Suporte perfeito para pescoço e coluna",
  "roupa-de-cama":     "✨ Proteção e conforto para seu investimento",
  "protetor":          "🛡️ Proteção total — mantém a garantia do colchão",
};
const BENEFICIO_DEFAULT = "✨ Qualidade Castor — fabricante líder em sono saudável";

router.post("/", async (req, res) => {
  try {
    const tenant = (req as TenantRequest).tenant ?? "default";
    const tenantCfg = TENANTS[tenant as keyof typeof TENANTS] ?? TENANTS.default;
    const nomeLojaHeader = tenantCfg.nome.toUpperCase();
    const whatsappLoja = formatarTelefone(tenantCfg.whatsapp);

    const { cliente, whatsapp, produtoIds, observacoes, descontoPix = 0 } = req.body;

    if (!cliente || !produtoIds || !Array.isArray(produtoIds) || produtoIds.length === 0) {
      res.status(400).json({ error: "Cliente e pelo menos um produto são obrigatórios" });
      return;
    }

    const ids = produtoIds.map((id: unknown) => parseInt(String(id)));
    const results = await db.select().from(produtosTable).where(inArray(produtosTable.id, ids));

    if (results.length === 0) {
      res.status(404).json({ error: "Nenhum produto encontrado" });
      return;
    }

    const ordenados = ids.map(id => results.find(p => p.id === id)).filter(Boolean) as typeof results;

    // Desconto extra do vendedor (além do PIX padrão de 15%).
    // REGRA: qualquer desconto é calculado sobre preço cheio (precoBase),
    // nunca sobre preço já reduzido. descontoPix = percentual ADICIONAL ao PIX padrão.
    const extraDesconto = Math.max(0, Math.min(85, Number(descontoPix) || 0));
    const totalDescontoPct = 15 + extraDesconto; // desconto total sobre preço cheio

    let totalPrecoBase = 0;

    const listaProdutos = ordenados.map((p, i) => {
      // precoBase: usa campo numérico se disponível, senão parseia campo texto
      const precoBaseNum = p.precoBase
        ? parseFloat(String(p.precoBase))
        : parsarPreco(p.preco);
      totalPrecoBase += precoBaseNum;

      const precoPixProduto = precoBaseNum * (1 - totalDescontoPct / 100);
      const beneficio = BENEFICIO_CATEGORIA[p.categoria] || BENEFICIO_DEFAULT;

      const linhas: string[] = [
        `${i + 1}️⃣ *${p.nome}*`,
        beneficio,
        "",
      ];

      const dimensoes = [p.medidas, p.altura].filter(Boolean).join(" | ");
      if (dimensoes) linhas.push(`📐 ${dimensoes}`);
      linhas.push("");
      // Ancoragem: preço cheio visível antes do desconto
      linhas.push(`De: ~${formatBRL(precoBaseNum)}~`);
      linhas.push(`💰 PIX: *${formatBRL(precoPixProduto)}* (${totalDescontoPct}% de desconto)`);
      linhas.push(`💳 Parcelado: ${formatBRL(precoBaseNum)} — 12x de ${formatBRL(precoBaseNum / 12)}`);

      return linhas.join("\n");
    });

    // Todos os cálculos partem do preço cheio — nunca de preço já reduzido
    const totalPixFinal = totalPrecoBase * (1 - totalDescontoPct / 100);
    const totalDescontoValor = totalPrecoBase - totalPixFinal;
    const parcela12 = totalPrecoBase / 12;

    const linhas: string[] = [
      "━━━━━━━━━━━━━━━━━━━━━━",
      `🇧🇷 ${nomeLojaHeader}`,
      "━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `Cliente: ${cliente}`,
      "",
      "Produtos Selecionados:",
      "",
      listaProdutos.join("\n\n"),
      "",
      "━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "RESUMO DO PEDIDO",
      "",
      `Preço cheio: ~${formatBRL(totalPrecoBase)}~`,
      "",
    ];

    if (extraDesconto > 0) {
      linhas.push(`💰 PIX (${totalDescontoPct}% de desconto sobre preço cheio)`);
    } else {
      linhas.push("💰 PIX (15% de desconto)");
    }
    linhas.push(`*${formatBRL(totalPixFinal)}*`);
    linhas.push("");
    linhas.push("💳 Parcelado (sem juros)");
    linhas.push(`*${formatBRL(totalPrecoBase)}* — 12x de *${formatBRL(parcela12)}*`);
    linhas.push("");
    linhas.push("━━━━━━━━━━━━━━━━━━━━━━");

    if (observacoes) {
      linhas.push("");
      linhas.push("📋 Observações:");
      linhas.push(observacoes);
      linhas.push("");
      linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
    }

    // CTA de fechamento (6ª etapa do template obrigatório)
    linhas.push("");
    linhas.push("👉 Gostou? Me confirma um *quero* e finalizo tudo agora pelo WhatsApp! 🛏️✨");
    linhas.push("");
    linhas.push("━━━━━━━━━━━━━━━━━━━━━━");
    if (whatsappLoja) {
      linhas.push("");
      linhas.push("📞 WhatsApp Loja");
      linhas.push(whatsappLoja);
    }

    const texto = linhas.join("\n");

    res.json({
      texto,
      totalPrecoBase: formatBRL(totalPrecoBase),
      totalPix: formatBRL(totalPixFinal),
      totalPrazo: formatBRL(totalPrecoBase),
      parcela12: formatBRL(parcela12),
      descontoAplicado: formatBRL(totalDescontoValor),
      descontoPercentual: totalDescontoPct,
      produtos: ordenados.map(p => ({
        id: p.id,
        nome: p.nome,
        sku: p.sku,
        preco: p.preco,
        precoPix: p.precoPix,
        precoBase: p.precoBase ? parseFloat(String(p.precoBase)) : parsarPreco(p.preco),
        parcelamento: p.parcelamento,
        medidas: p.medidas,
        altura: p.altura,
        categoria: p.categoria,
        imagem: p.imagem,
        link: p.link,
        criadoEm: p.criadoEm,
      }))
    });
  } catch (error) {
    console.error("Erro ao gerar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/salvar", async (req, res) => {
  try {
    const tenant = (req as TenantRequest).tenant ?? "default";
    const {
      cliente, whatsapp, produtosJson, observacoes, descontoPix,
      totalPix, totalPrazo, texto, vendedor,
      precoBaseTotal, descontoAplicado,
    } = req.body;

    if (!cliente || !texto) {
      res.status(400).json({ error: "Dados insuficientes para salvar" });
      return;
    }

    const inserted = await db.insert(orcamentosTable).values({
      tenantId: tenant,
      cliente,
      whatsapp: whatsapp || null,
      produtosJson: produtosJson || [],
      observacoes: observacoes || null,
      descontoPix: descontoPix || 0,
      totalPix: totalPix || null,
      totalPrazo: totalPrazo || null,
      texto,
      vendedor: vendedor || null,
      status: "pendente",
      precoBaseTotal: precoBaseTotal || null,
      descontoAplicado: descontoAplicado || null,
    }).returning();

    res.json({ id: inserted[0].id, mensagem: "Orçamento salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/historico", requireAuth, async (req, res) => {
  try {
    const tenant = (req as TenantRequest).tenant ?? "default";
    const session = (req as any).session as { nome: string; papel: string };
    const page = Math.max(0, parseInt(String(req.query.page ?? "0")) || 0);
    const limit = 50;
    const offset = page * limit;

    const cols = {
      id: orcamentosTable.id,
      cliente: orcamentosTable.cliente,
      whatsapp: orcamentosTable.whatsapp,
      status: orcamentosTable.status,
      vendedor: orcamentosTable.vendedor,
      totalPix: orcamentosTable.totalPix,
      totalPrazo: orcamentosTable.totalPrazo,
      descontoPix: orcamentosTable.descontoPix,
      observacoes: orcamentosTable.observacoes,
      produtosJson: orcamentosTable.produtosJson,
      criadoEm: orcamentosTable.criadoEm,
    };

    const tenantCond = eq(orcamentosTable.tenantId, tenant);
    const vendedorCond: SQL | undefined = session.papel !== "dono"
      ? eq(orcamentosTable.vendedor, session.nome)
      : undefined;

    const filtro: SQL | undefined = vendedorCond
      ? and(tenantCond, vendedorCond)
      : tenantCond;

    const historico = await db.select(cols).from(orcamentosTable)
      .where(filtro)
      .orderBy(desc(orcamentosTable.criadoEm))
      .limit(limit)
      .offset(offset);
    res.json(historico);
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ── Fechar venda: marca orçamento como vendido e cria entrega ──────────────
router.post("/:id/fechar", requireAuth, async (req, res) => {
  try {
    const tenant = (req as TenantRequest).tenant ?? "default";
    const id = parseInt(str(req.params.id));
    const { endereco, observacoes, dataEntrega } = req.body;

    if (!id || isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [orc] = await db.select().from(orcamentosTable)
      .where(and(eq(orcamentosTable.id, id), eq(orcamentosTable.tenantId, tenant)));
    if (!orc) {
      res.status(404).json({ error: "Orçamento não encontrado" });
      return;
    }

    if (orc.status === "vendido") {
      res.status(409).json({ error: "Orçamento já foi fechado como venda" });
      return;
    }

    interface ProdutoItem { id?: number; nome?: string }
    const produtosJson: ProdutoItem[] = Array.isArray(orc.produtosJson)
      ? (orc.produtosJson as ProdutoItem[])
      : [];

    const qtdPorId = new Map<number, number>();
    for (const p of produtosJson) {
      if (p.id) qtdPorId.set(p.id, (qtdPorId.get(p.id) || 0) + 1);
    }

    const produtos = produtosJson.map((p) => p.nome).filter(Boolean).join(", ");

    const result = await db.transaction(async (tx) => {
      await tx.update(orcamentosTable)
        .set({ status: "vendido" })
        .where(eq(orcamentosTable.id, id));

      if (qtdPorId.size > 0) {
        const prods = await tx.select().from(produtosTable).where(inArray(produtosTable.id, [...qtdPorId.keys()]));
        for (const prod of prods) {
          if (prod.estoque !== null && prod.estoque > 0) {
            const qty = qtdPorId.get(prod.id) || 1;
            const novoEstoque = Math.max(0, prod.estoque - qty);
            await tx.update(produtosTable)
              .set({ estoque: novoEstoque, disponivel: novoEstoque > 0 })
              .where(eq(produtosTable.id, prod.id));
          }
        }
      }

      const [entrega] = await tx.insert(entregasTable).values({
        tenantId: tenant,
        orcamentoId: id,
        cliente: orc.cliente,
        whatsapp: orc.whatsapp || null,
        endereco: endereco || null,
        produtos: produtos || null,
        vendedor: orc.vendedor || null,
        status: "pendente",
        observacoes: observacoes || null,
        dataEntrega: dataEntrega || null,
      }).returning();

      return entrega;
    });

    res.json({ mensagem: "Venda fechada! Entrega criada.", entregaId: result.id });
  } catch (error) {
    console.error("Erro ao fechar venda:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
