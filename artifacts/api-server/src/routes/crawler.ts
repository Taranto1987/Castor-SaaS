import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { produtosTable, crawlerStatusTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import { getSession, isDono } from "../lib/sessions";

const router: IRouter = Router();

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Sessão não encontrada" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  if (!isDono(session)) { res.status(403).json({ error: "Acesso restrito ao dono" }); return; }
  next();
}

let crawlerRunning = false;

const gql = axios.create({
  baseURL: "https://lojacastor.com.br",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Store": "castor",
  },
});

interface GqlProduct {
  id: number;
  name: string;
  sku: string;
  url_key: string;
  small_image: { url: string } | null;
  price_range: {
    minimum_price: {
      regular_price: { value: number; currency: string };
      final_price: { value: number; currency: string };
    };
  };
  description?: { html: string } | null;
  custom_attributes?: Array<{ attribute_code: string; value: string }> | null;
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

async function fetchCategoryProducts(categoryId: number, catName: string): Promise<GqlProduct[]> {
  const allItems: GqlProduct[] = [];
  let currentPage = 1;
  const pageSize = 48;

  while (true) {
    const query = `{
      products(
        filter: { category_id: { eq: "${categoryId}" } }
        pageSize: ${pageSize}
        currentPage: ${currentPage}
      ) {
        total_count
        items {
          id
          name
          sku
          url_key
          small_image { url }
          price_range {
            minimum_price {
              regular_price { value currency }
              final_price { value currency }
            }
          }
          description { html }
        }
      }
    }`;

    try {
      const { data } = await gql.post("/graphql", { query });
      const items: GqlProduct[] = data?.data?.products?.items ?? [];
      const totalCount: number = data?.data?.products?.total_count ?? 0;

      if (items.length === 0) break;
      allItems.push(...items);

      if (allItems.length >= totalCount) break;
      currentPage++;
    } catch (err) {
      console.error(`[Crawler] Erro ao buscar categoria ${catName} página ${currentPage}:`, err);
      break;
    }
  }

  return allItems;
}


async function getCrawlerStatus() {
  const results = await db.select().from(crawlerStatusTable).orderBy(crawlerStatusTable.id).limit(1);
  if (results.length === 0) {
    return { status: "idle" as const, mensagem: "Aguardando início da coleta", totalProdutos: 0, produtosColetados: 0, erros: 0 };
  }
  const r = results[0];
  return {
    status: r.status as "idle" | "running" | "completed" | "error",
    mensagem: r.mensagem,
    totalProdutos: parseInt(r.totalProdutos ?? "0"),
    produtosColetados: parseInt(r.produtosColetados ?? "0"),
    erros: parseInt(r.erros ?? "0"),
    iniciadoEm: r.iniciadoEm?.toISOString(),
    finalizadoEm: r.finalizadoEm?.toISOString(),
  };
}

async function atualizarStatus(status: string, mensagem: string, produtosColetados: number, erros: number, totalProdutos = 0, finalizado = false) {
  const existing = await db.select({ id: crawlerStatusTable.id }).from(crawlerStatusTable).limit(1);
  const data: typeof crawlerStatusTable.$inferInsert = {
    status, mensagem,
    produtosColetados: String(produtosColetados),
    erros: String(erros),
    totalProdutos: String(totalProdutos),
    atualizadoEm: new Date(),
    ...(finalizado ? { finalizadoEm: new Date() } : {}),
  };

  if (existing.length === 0) {
    await db.insert(crawlerStatusTable).values({ ...data, iniciadoEm: new Date() });
  } else {
    await db.update(crawlerStatusTable).set(data).where(eq(crawlerStatusTable.id, existing[0].id));
  }
}

async function executarCrawler() {
  crawlerRunning = true;
  let produtosColetados = 0;
  let erros = 0;

  // Category IDs for the categories we sell
  const categorias = [
    { id: 3,   nome: "colchoes" },
    { id: 6,   nome: "cama-box" },
    { id: 5,   nome: "cama-box-colchao" },
    { id: 4,   nome: "travesseiros" },
    { id: 973, nome: "roupa-de-cama" },
    { id: 1016, nome: "protetor" },
  ];

  const seenIds = new Set<number>();
  const seenSkus = new Set<string>();

  try {
    await atualizarStatus("running", "Buscando produtos via API...", 0, 0);

    // Count total first
    let totalEstimado = 0;
    for (const cat of categorias) {
      try {
        const { data } = await gql.post("/graphql", {
          query: `{ products(filter: { category_id: { eq: "${cat.id}" } } pageSize: 1 currentPage: 1) { total_count } }`
        });
        totalEstimado += data?.data?.products?.total_count ?? 0;
      } catch {}
    }

    await atualizarStatus("running", `${totalEstimado} produtos encontrados. Salvando...`, 0, 0, totalEstimado);

    for (const categoria of categorias) {
      await atualizarStatus("running", `Coletando: ${categoria.nome}`, produtosColetados, erros, totalEstimado);

      const items = await fetchCategoryProducts(categoria.id, categoria.nome);
      console.log(`[Crawler] ${categoria.nome}: ${items.length} produtos`);

      for (const item of items) {
        if (!item.sku) continue;
        if (seenIds.has(item.id)) continue;
        if (seenSkus.has(item.sku)) continue;
        seenIds.add(item.id);
        seenSkus.add(item.sku);

        const precoRegular = item.price_range.minimum_price.regular_price.value;
        const preco = formatBRL(precoRegular);

        // PIX = 15% de desconto sobre o PREÇO CHEIO (nunca sobre preço já descontado)
        const precoPix = formatBRL(precoRegular * 0.85);

        // link stays as internal crawler_origin — NEVER sent to frontend
        const link = `https://lojacastor.com.br/${item.url_key}`;
        // slug is the public-facing identifier for internal PDP routes
        const slug = item.url_key;
        const imagem = item.small_image?.url ?? "";

        // Extract dimensions from description HTML
        const html = (item as { description?: { html?: string } }).description?.html ?? "";
        const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        const medidasMatch = text.match(/(\d{2,3})\s*[xX×]\s*(\d{2,3})/);
        const medidas = medidasMatch ? `${medidasMatch[1]}x${medidasMatch[2]}` : "";
        const alturaMatch = text.match(/(\d{2,3})\s*cm/i);
        const altura = alturaMatch ? alturaMatch[0] : "";

        try {
          await db.insert(produtosTable).values({
            nome: item.name,
            sku: item.sku,
            slug,
            link,          // internal only — crawler_origin
            preco,
            precoPix,
            precoBase: String(precoRegular),
            parcelamento: `12x de ${formatBRL(precoRegular / 12)}`,
            medidas: medidas || null,
            altura: altura || null,
            categoria: categoria.nome,
            imagem: imagem || null,
          }).onConflictDoUpdate({
            target: produtosTable.sku,
            set: {
              slug,
              link,
              nome: item.name,
              preco,
              precoPix,
              precoBase: String(precoRegular),
              parcelamento: `12x de ${formatBRL(precoRegular / 12)}`,
              medidas: medidas || null,
              altura: altura || null,
              categoria: categoria.nome,
              imagem: imagem || null,
            },
          });
          produtosColetados++;
        } catch (err) {
          console.error(`[Crawler] Erro ao salvar ${item.name}:`, err);
          erros++;
        }

        if (produtosColetados % 10 === 0) {
          await atualizarStatus("running", `Salvando ${categoria.nome} — ${produtosColetados}/${totalEstimado}`, produtosColetados, erros, totalEstimado);
        }
      }
    }

    await atualizarStatus("completed", `✅ Coleta finalizada! ${produtosColetados} produtos salvos.`, produtosColetados, erros, produtosColetados, true);
    console.log(`[Crawler] Finalizado: ${produtosColetados} produtos, ${erros} erros`);
  } catch (error) {
    console.error("[Crawler] Erro fatal:", error);
    await atualizarStatus("error", `Erro: ${String(error)}`, produtosColetados, erros, 0, true);
  } finally {
    crawlerRunning = false;
  }
}

router.post("/iniciar", requireDono, async (_req, res) => {
  if (crawlerRunning) {
    res.json({ status: "running", mensagem: "Crawler já está em execução", totalProdutos: 0, produtosColetados: 0, erros: 0 });
    return;
  }

  // Clear old products if re-running
  const existing = await db.select({ id: crawlerStatusTable.id }).from(crawlerStatusTable).limit(1);
  const initData = {
    status: "running", mensagem: "Iniciando...",
    totalProdutos: "0", produtosColetados: "0", erros: "0",
    iniciadoEm: new Date(), atualizadoEm: new Date(),
    finalizadoEm: null as Date | null,
  };

  if (existing.length === 0) {
    await db.insert(crawlerStatusTable).values(initData);
  } else {
    await db.update(crawlerStatusTable).set(initData).where(eq(crawlerStatusTable.id, existing[0].id));
  }

  // Clear previous products before re-collecting
  await db.delete(produtosTable);

  executarCrawler().catch(console.error);

  res.json({
    status: "running", mensagem: "Crawler iniciado! Aguarde a coleta.",
    totalProdutos: 0, produtosColetados: 0, erros: 0,
    iniciadoEm: new Date().toISOString(),
  });
});

router.get("/status", async (_req, res) => {
  try {
    res.json(await getCrawlerStatus());
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
