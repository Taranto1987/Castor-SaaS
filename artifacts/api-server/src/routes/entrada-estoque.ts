import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { produtosTable, entradasEstoqueTable, itensEntradaEstoqueTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, and } from "drizzle-orm";
import { getSession, isDono } from "../lib/sessions";

const router: IRouter = Router();

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não suportado. Use JPEG, PNG, WebP ou PDF."));
    }
  },
});

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  if (!isDono(session)) {
    res.status(403).json({ error: "Acesso restrito ao proprietário" });
    return;
  }
  next();
}

router.use(requireDono);

interface ItemExtraido {
  nome: string;
  quantidade: number;
  sku?: string;
  precoCusto?: string;
}

async function getGeminiClient() {
  const { ai } = await import("@workspace/integrations-gemini-ai");
  return ai;
}

router.post("/extrair", upload.single("imagem"), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ error: "Imagem da nota fiscal é obrigatória" });
      return;
    }

    const base64 = file.buffer.toString("base64");
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
      ai = await getGeminiClient();
    } catch (err) {
      console.error("[EntradaEstoque] Gemini AI não configurado:", err);
      res.status(503).json({ error: "Serviço de IA não disponível. Verifique a configuração do Gemini." });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "";
    let parsed: { fornecedor?: string; itens: ItemExtraido[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        res.status(422).json({ error: "Não foi possível extrair itens da nota fiscal" });
        return;
      }
    }

    if (!parsed.itens || !Array.isArray(parsed.itens)) {
      res.status(422).json({ error: "Formato de resposta inválido" });
      return;
    }

    res.json({
      fornecedor: parsed.fornecedor || null,
      itens: parsed.itens.map((item) => ({
        nome: item.nome || "",
        quantidade: Math.max(1, Math.round(Number(item.quantidade) || 1)),
        sku: item.sku || null,
        precoCusto: item.precoCusto || null,
      })),
    });
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao extrair:", error);
    res.status(500).json({ error: "Erro ao processar imagem da nota fiscal" });
  }
});

router.post("/match", async (req, res) => {
  try {
    const { itens } = req.body as { itens: ItemExtraido[] };
    if (!itens || !Array.isArray(itens)) {
      res.status(400).json({ error: "Lista de itens é obrigatória" });
      return;
    }

    const allProducts = await db.select().from(produtosTable).orderBy(produtosTable.nome);

    const results = itens.map((item) => {
      let bestMatch: typeof allProducts[0] | null = null;
      let bestScore = 0;

      const nomeNorm = normalize(item.nome);
      const skuNorm = item.sku ? normalize(item.sku) : null;

      for (const prod of allProducts) {
        let score = 0;

        if (skuNorm && prod.sku && normalize(prod.sku) === skuNorm) {
          score = 100;
        } else {
          const prodNomeNorm = normalize(prod.nome);
          score = similarityScore(nomeNorm, prodNomeNorm);

          if (prod.medidas && item.nome.includes(prod.medidas)) {
            score += 15;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = prod;
        }
      }

      return {
        ...item,
        produtoMatch: bestScore >= 40 && bestMatch ? {
          id: bestMatch.id,
          nome: bestMatch.nome,
          sku: bestMatch.sku,
          medidas: bestMatch.medidas,
          estoqueAtual: bestMatch.estoque,
          custoBRL: bestMatch.custoBRL,
        } : null,
        score: bestScore,
      };
    });

    res.json(results);
  } catch (error) {
    console.error("[EntradaEstoque] Erro no matching:", error);
    res.status(500).json({ error: "Erro ao buscar correspondências" });
  }
});

router.post("/confirmar", async (req, res) => {
  try {
    const { fornecedor, itens } = req.body as {
      fornecedor?: string;
      itens: Array<{
        nomeExtraido: string;
        skuExtraido?: string;
        quantidade: number;
        precoCusto?: string;
        produtoId?: number;
      }>;
    };

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ error: "Lista de itens é obrigatória" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [entrada] = await tx.insert(entradasEstoqueTable).values({
        fornecedor: fornecedor || null,
        totalItens: itens.length,
      }).returning();

      for (const item of itens) {
        await tx.insert(itensEntradaEstoqueTable).values({
          entradaId: entrada.id,
          produtoId: item.produtoId || null,
          nomeExtraido: item.nomeExtraido,
          skuExtraido: item.skuExtraido || null,
          quantidade: item.quantidade,
          precoCusto: item.precoCusto || null,
        });

        if (item.produtoId && item.quantidade > 0) {
          const [produto] = await tx.select().from(produtosTable).where(eq(produtosTable.id, item.produtoId)).limit(1);
          if (produto) {
            const novoEstoque = (produto.estoque ?? 0) + item.quantidade;
            const updateData: Record<string, unknown> = {
              estoque: novoEstoque,
              disponivel: novoEstoque > 0,
            };
            if (item.precoCusto) {
              updateData.custoBRL = item.precoCusto;
            }
            await tx.update(produtosTable).set(updateData).where(eq(produtosTable.id, item.produtoId));
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

router.get("/historico", async (_req, res) => {
  try {
    const entradas = await db.select().from(entradasEstoqueTable).orderBy(desc(entradasEstoqueTable.criadoEm)).limit(50);
    const result = [];

    for (const entrada of entradas) {
      const itens = await db.select().from(itensEntradaEstoqueTable).where(eq(itensEntradaEstoqueTable.entradaId, entrada.id));
      result.push({ ...entrada, itens });
    }

    res.json(result);
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao buscar histórico:", error);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

router.get("/produtos/buscar", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "Parâmetro q obrigatório" });
      return;
    }
    const termos = q.trim().split(/\s+/);
    const conds = termos.map((t) =>
      or(
        ilike(produtosTable.nome, `%${t}%`),
        ilike(produtosTable.sku, `%${t}%`),
        ilike(produtosTable.medidas, `%${t}%`)
      )
    );

    const results = await db
      .select({ id: produtosTable.id, nome: produtosTable.nome, sku: produtosTable.sku, medidas: produtosTable.medidas, estoque: produtosTable.estoque, custoBRL: produtosTable.custoBRL })
      .from(produtosTable)
      .where(conds.length === 1 ? conds[0] : and(...conds))
      .limit(20);

    res.json(results);
  } catch (error) {
    console.error("[EntradaEstoque] Erro ao buscar produtos:", error);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarityScore(a: string, b: string): number {
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  let matches = 0;
  for (const word of wordsA) {
    if (word.length < 2) continue;
    if (wordsB.some((w) => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }
  const totalWords = Math.max(wordsA.length, 1);
  return Math.round((matches / totalWords) * 100);
}

export default router;
