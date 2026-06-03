import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { produtosTable, entradasEstoqueTable, itensEntradaEstoqueTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, and } from "drizzle-orm";
import { getSession, isDono } from "../lib/sessions";
import { parseNFe } from "../lib/nfe-parser";
import { suggestMarkup } from "../lib/markup-engine";

const router: IRouter = Router();

// ── Auth ───────────────────────────────────────────────────────────────────────

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Não autenticado" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida" }); return; }
  if (!isDono(session)) { res.status(403).json({ error: "Acesso restrito ao proprietário" }); return; }
  (req as Request & { lojaId: number }).lojaId = session.lojaId;
  next();
}

router.use(requireDono);

// ── Multer ─────────────────────────────────────────────────────────────────────

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const XML_MIME_TYPES   = ["application/xml", "text/xml"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de arquivo não suportado. Use JPEG, PNG, WebP ou PDF."));
  },
});

const uploadXml = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = XML_MIME_TYPES.includes(file.mimetype) || file.originalname.endsWith(".xml");
    if (ok) cb(null, true);
    else cb(new Error("Somente arquivos XML NF-e são aceitos neste endpoint."));
  },
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface ItemExtraido {
  nome: string;
  quantidade: number;
  sku?: string | null;
  precoCusto?: string | null;
  custoUnitario?: number | null;
}

// ── /extrair — OCR via Gemini (foto / PDF) ────────────────────────────────────

router.post("/extrair", upload.single("imagem"), async (req, res) => {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) { res.status(400).json({ error: "Imagem da nota fiscal é obrigatória" }); return; }

    const base64  = file.buffer.toString("base64");
    const mimeType = file.mimetype || "image/jpeg";

    const prompt = `Você é um especialista em leitura de notas fiscais brasileiras. Analise esta imagem de nota fiscal e extraia TODOS os produtos/itens listados.

Para cada item, extraia:
- nome: nome do produto exatamente como aparece na nota
- quantidade: quantidade (número inteiro)
- sku: código do produto se visível (ou null)
- precoCusto: preço unitário do item (formato "R$ XX,XX" ou apenas o número, ou null se não visível)

Responda APENAS com um JSON válido no formato:
{
  "fornecedor": "nome do fornecedor se visível ou null",
  "itens": [
    { "nome": "...", "quantidade": 1, "sku": "...", "precoCusto": "..." }
  ]
}

Não inclua explicações, apenas o JSON.`;

    let ai;
    try {
      const mod = await import("@workspace/integrations-gemini-ai");
      ai = mod.ai;
    } catch (err) {
      console.error("[EntradaEstoque] Gemini AI não configurado:", err);
      res.status(503).json({ error: "Serviço de IA não disponível. Verifique a configuração do Gemini." });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const text = response.text ?? "";
    let parsed: { fornecedor?: string; itens: ItemExtraido[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else { res.status(422).json({ error: "Não foi possível extrair itens da nota fiscal" }); return; }
    }

    if (!parsed.itens || !Array.isArray(parsed.itens)) {
      res.status(422).json({ error: "Formato de resposta inválido" });
      return;
    }

    res.json({
      fornecedor: parsed.fornecedor || null,
      itens: parsed.itens.map((item) => ({
        nome:          item.nome || "",
        quantidade:    Math.max(1, Math.round(Number(item.quantidade) || 1)),
        sku:           item.sku || null,
        precoCusto:    item.precoCusto || null,
        custoUnitario: null,
      })),
    });
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao extrair:", error);
    res.status(500).json({ error: "Erro ao processar imagem da nota fiscal" });
  }
});

// ── /extrair-xml — parse determinístico de NF-e XML ──────────────────────────

router.post("/extrair-xml", uploadXml.single("arquivo"), async (req, res) => {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) { res.status(400).json({ error: "Arquivo XML NF-e é obrigatório" }); return; }

    const xml = file.buffer.toString("utf-8");
    const parsed = parseNFe(xml);

    if (parsed.itens.length === 0) {
      res.status(422).json({ error: "Nenhum item encontrado no XML. Verifique se é um arquivo NF-e válido." });
      return;
    }

    res.json({
      fornecedor:      parsed.fornecedor,
      cnpjFornecedor:  parsed.cnpjFornecedor,
      numeroNF:        parsed.numeroNF,
      itens: parsed.itens.map((item) => ({
        nome:          item.nome,
        quantidade:    item.quantidade,
        sku:           item.sku,
        precoCusto:    item.precoCusto,
        custoUnitario: item.custoUnitario > 0 ? item.custoUnitario : null,
      })),
    });
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao parsear XML:", error);
    res.status(500).json({ error: "Erro ao processar XML da NF-e" });
  }
});

// ── /match — fuzzy matching + markup suggestion ───────────────────────────────

router.post("/match", async (req, res) => {
  const lojaId = (req as Request & { lojaId: number }).lojaId;
  try {
    const { itens } = req.body as { itens: ItemExtraido[] };
    if (!itens || !Array.isArray(itens)) { res.status(400).json({ error: "Lista de itens é obrigatória" }); return; }

    const allProducts = await db
      .select({
        id: produtosTable.id,
        nome: produtosTable.nome,
        sku: produtosTable.sku,
        medidas: produtosTable.medidas,
        estoque: produtosTable.estoque,
        custoBRL: produtosTable.custoBRL,
        categoria: produtosTable.categoria,
      })
      .from(produtosTable)
      .where(eq(produtosTable.lojaId, lojaId))
      .orderBy(produtosTable.nome);

    const results = itens.map((item) => {
      let bestMatch: typeof allProducts[0] | null = null;
      let bestScore = 0;

      const nomeNorm = normalize(item.nome);
      const skuNorm  = item.sku ? normalize(item.sku) : null;

      for (const prod of allProducts) {
        let score = 0;
        if (skuNorm && prod.sku && normalize(prod.sku) === skuNorm) {
          score = 100;
        } else {
          score = similarityScore(nomeNorm, normalize(prod.nome));
          if (prod.medidas && item.nome.includes(prod.medidas)) score += 15;
        }
        if (score > bestScore) { bestScore = score; bestMatch = prod; }
      }

      const custoUnitario = item.custoUnitario ?? null;
      const categoria = bestScore >= 40 && bestMatch ? bestMatch.categoria : null;
      const markup = suggestMarkup(custoUnitario ?? 0, categoria, item.nome);

      return {
        ...item,
        produtoMatch: bestScore >= 40 && bestMatch ? {
          id:           bestMatch.id,
          nome:         bestMatch.nome,
          sku:          bestMatch.sku,
          medidas:      bestMatch.medidas,
          estoqueAtual: bestMatch.estoque,
          custoBRL:     bestMatch.custoBRL,
          categoria:    bestMatch.categoria,
        } : null,
        score: bestScore,
        markup,
      };
    });

    res.json(results);
  } catch (error) {
    console.error("[EntradaEstoque] Erro no matching:", error);
    res.status(500).json({ error: "Erro ao buscar correspondências" });
  }
});

// ── /confirmar — registra entrada + atualiza estoque + pricing ────────────────

router.post("/confirmar", async (req, res) => {
  const lojaId = (req as Request & { lojaId?: number }).lojaId ?? 1;

  try {
    const { fornecedor, numeroNF, cnpjFornecedor, itens } = req.body as {
      fornecedor?: string;
      numeroNF?: string;
      cnpjFornecedor?: string;
      itens: Array<{
        nomeExtraido:       string;
        skuExtraido?:       string | null;
        quantidade:         number;
        precoCusto?:        string | null;
        custoUnitario?:     number | null;
        markupPercent?:     number | null;
        outletMarkupPercent?: number | null;
        outletPrice?:       number | null;
        precoSugerido?:     number | null;
        produtoId?:         number | null;
      }>;
    };

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ error: "Lista de itens é obrigatória" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [entrada] = await tx.insert(entradasEstoqueTable).values({
        lojaId,
        fornecedor:     fornecedor || null,
        numeroNF:       numeroNF   || null,
        cnpjFornecedor: cnpjFornecedor || null,
        totalItens:     itens.length,
      }).returning();

      for (const item of itens) {
        await tx.insert(itensEntradaEstoqueTable).values({
          entradaId:     entrada.id,
          produtoId:     item.produtoId || null,
          nomeExtraido:  item.nomeExtraido,
          skuExtraido:   item.skuExtraido || null,
          quantidade:    item.quantidade,
          precoCusto:    item.precoCusto || null,
          custoUnitario: item.custoUnitario != null ? String(item.custoUnitario) : null,
          markupPercent: item.markupPercent != null ? String(item.markupPercent) : null,
          precoSugerido: item.precoSugerido != null ? String(item.precoSugerido) : null,
        });

        if (item.produtoId && item.quantidade > 0) {
          const [produto] = await tx
            .select()
            .from(produtosTable)
            .where(and(eq(produtosTable.id, item.produtoId), eq(produtosTable.lojaId, lojaId)))
            .limit(1);

          if (produto) {
            const novoEstoque = (produto.estoque ?? 0) + item.quantidade;
            const update: Record<string, unknown> = {
              estoque:   novoEstoque,
              disponivel: novoEstoque > 0,
            };

            // Persist text cost for display
            if (item.precoCusto) update.custoBRL = item.precoCusto;

            // Persist numeric cost into pricing engine fields
            if (item.custoUnitario && item.custoUnitario > 0) {
              update.factoryCost = String(item.custoUnitario);
            }
            if (item.outletMarkupPercent != null) {
              update.outletMarkupPercent = String(item.outletMarkupPercent);
            }
            if (item.outletPrice && item.outletPrice > 0) {
              update.outletPrice = String(item.outletPrice);
            }

            await tx.update(produtosTable).set(update).where(and(eq(produtosTable.id, item.produtoId), eq(produtosTable.lojaId, lojaId)));
          }
        }
      }

      return entrada;
    });

    res.json({ success: true, entradaId: result.id });
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao confirmar:", error);
    res.status(500).json({ error: "Erro ao confirmar entrada de estoque" });
  }
});

// ── /historico ────────────────────────────────────────────────────────────────

router.get("/historico", async (req, res) => {
  const lojaId = (req as Request & { lojaId: number }).lojaId;
  try {
    const entradas = await db
      .select()
      .from(entradasEstoqueTable)
      .where(eq(entradasEstoqueTable.lojaId, lojaId))
      .orderBy(desc(entradasEstoqueTable.criadoEm))
      .limit(50);
    const result = [];
    for (const entrada of entradas) {
      const itens = await db
        .select()
        .from(itensEntradaEstoqueTable)
        .where(eq(itensEntradaEstoqueTable.entradaId, entrada.id));
      result.push({ ...entrada, itens });
    }
    res.json(result);
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao buscar histórico:", error);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// ── /produtos/buscar ──────────────────────────────────────────────────────────

router.get("/produtos/buscar", async (req, res) => {
  const lojaId = (req as Request & { lojaId: number }).lojaId;
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") { res.status(400).json({ error: "Parâmetro q obrigatório" }); return; }
    const termos = q.trim().split(/\s+/);
    const conds = termos.map((t) =>
      or(
        ilike(produtosTable.nome, `%${t}%`),
        ilike(produtosTable.sku, `%${t}%`),
        ilike(produtosTable.medidas, `%${t}%`),
      )
    );

    const results = await db
      .select({
        id:       produtosTable.id,
        nome:     produtosTable.nome,
        sku:      produtosTable.sku,
        medidas:  produtosTable.medidas,
        estoque:  produtosTable.estoque,
        custoBRL: produtosTable.custoBRL,
        categoria: produtosTable.categoria,
      })
      .from(produtosTable)
      .where(and(eq(produtosTable.lojaId, lojaId), ...conds))
      .limit(20);

    res.json(results);
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao buscar produtos:", error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarityScore(a: string, b: string): number {
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  let matches  = 0;
  for (const word of wordsA) {
    if (word.length < 2) continue;
    if (wordsB.some((w) => w.includes(word) || word.includes(w))) matches++;
  }
  return Math.round((matches / Math.max(wordsA.length, 1)) * 100);
}

export default router;
