import { Router, type IRouter } from "express";
import { db, extractFamilyInfo } from "@workspace/db";
import { produtosTable, crawlerStatusTable, lojasTable } from "@workspace/db/schema";
import { eq, lt, and, sql } from "drizzle-orm";
import { markNonStandardProducts } from "./catalog";
import axios from "axios";
import { requireDono } from "../middlewares/auth";
import { formatBRL } from "../services/shared/currency";
import { sincronizarProdutos as sincronizarMetaCatalogo } from "../services/meta-catalog.service";
import { classificarDeTextoLivre } from "../medidas";

const router: IRouter = Router();

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
  short_description?: { html: string } | null;
  media_gallery?: Array<{ url: string; label: string | null }> | null;
  meta_title?: string | null;
  meta_description?: string | null;
  custom_attributes?: Array<{ attribute_code: string; value: string }> | null;
}

// Strip HTML para texto legível (reaproveitado na extração de medidas/altura e ficha).
function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function slugifyKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// Constrói a ficha técnica normalizada a partir do HTML da descrição + atributos Magento.
// Estratégia tolerante: nunca lança; chaves ausentes simplesmente não aparecem.
// Mantém o payload bruto sob `_raw` para reprocessamento futuro sem re-crawl.
function parseFichaTecnica(item: GqlProduct): Record<string, unknown> {
  const ficha: Record<string, unknown> = {};

  // 1. Atributos EAV/custom do Magento (quando a loja os expõe no GraphQL).
  if (Array.isArray(item.custom_attributes)) {
    for (const attr of item.custom_attributes) {
      if (!attr?.attribute_code) continue;
      const v = typeof attr.value === "string" ? attr.value.trim() : attr.value;
      if (v === undefined || v === null || v === "") continue;
      ficha[slugifyKey(attr.attribute_code)] = v;
    }
  }

  // 2. Pares "Chave: Valor" extraídos do HTML da descrição/short_description.
  //    Captura linhas curtas tipo "Densidade: D33", "Garantia: 1 ano", "Altura: 32cm".
  const sources = [item.description?.html, item.short_description?.html].filter(Boolean) as string[];
  for (const html of sources) {
    // Quebra por tags de bloco/linha antes de strippar, p/ preservar pares por linha.
    const linhas = html
      .replace(/<\s*(br|\/p|\/li|\/td|\/tr|\/div|\/h[1-6])\s*>/gi, "\n")
      .split(/\n+/)
      .map(htmlToText)
      .filter(Boolean);
    for (const linha of linhas) {
      const m = linha.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 /()\-]{1,40}?)\s*[:：]\s*(.+)$/);
      if (!m) continue;
      const chave = slugifyKey(m[1]);
      const valor = m[2].trim();
      if (!chave || !valor || valor.length > 200) continue;
      if (!(chave in ficha)) ficha[chave] = valor; // custom_attributes têm prioridade
    }
  }

  // 3. Payload bruto preservado (lossless).
  const raw: Record<string, unknown> = {};
  if (item.description?.html) raw.description_html = item.description.html;
  if (item.short_description?.html) raw.short_description_html = item.short_description.html;
  if (item.meta_title) raw.meta_title = item.meta_title;
  if (item.meta_description) raw.meta_description = item.meta_description;
  if (Array.isArray(item.media_gallery) && item.media_gallery.length > 0) {
    raw.media_gallery = item.media_gallery.map((m) => ({ url: m.url, label: m.label ?? null }));
  }
  if (Array.isArray(item.custom_attributes) && item.custom_attributes.length > 0) {
    raw.custom_attributes = item.custom_attributes;
  }
  if (Object.keys(raw).length > 0) ficha._raw = raw;

  return ficha;
}

// Campos básicos sempre disponíveis no ProductInterface (query de fallback segura).
const BASE_FIELDS = `
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
  short_description { html }`;

// Campos extras (estáveis no ProductInterface Magento 2) + custom_attributes (pode não
// existir em todas as instâncias). Se a query rica falhar na validação do GraphQL — que é
// all-or-nothing — caímos no BASE_FIELDS para NUNCA coletar 0 produtos (o que dispararia o
// soft-delete em massa no fim do sync).
const RICH_FIELDS = `${BASE_FIELDS}
  media_gallery { url label }
  meta_title
  meta_description
  custom_attributes { attribute_code value }`;

function buildQuery(categoryId: number, pageSize: number, currentPage: number, fields: string): string {
  return `{
    products(
      filter: { category_id: { eq: "${categoryId}" } }
      pageSize: ${pageSize}
      currentPage: ${currentPage}
    ) {
      total_count
      items {${fields}
      }
    }
  }`;
}

async function fetchCategoryProducts(categoryId: number, catName: string): Promise<GqlProduct[]> {
  const allItems: GqlProduct[] = [];
  let currentPage = 1;
  const pageSize = 48;
  // Começa otimista (campos ricos). Se o servidor rejeitar algum campo, degrada p/ os básicos.
  let fields = RICH_FIELDS;

  while (true) {
    try {
      const { data } = await gql.post("/graphql", { query: buildQuery(categoryId, pageSize, currentPage, fields) });

      // GraphQL retorna 200 com `errors` em falha de validação de campo.
      if (Array.isArray(data?.errors) && data.errors.length > 0 && fields === RICH_FIELDS) {
        console.warn(`[Crawler] ${catName}: query rica rejeitada (${data.errors[0]?.message ?? "erro"}). Degradando para campos básicos.`);
        fields = BASE_FIELDS;
        continue; // refaz a MESMA página com a query mínima
      }

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
  const syncStart = new Date();

  // Category IDs for the categories we sell
  const categorias = [
    { id: 3,   nome: "colchoes" },
    { id: 6,   nome: "cama-box" },
    { id: 5,   nome: "cama-box-colchao" },
    { id: 4,   nome: "travesseiros" },
    { id: 973, nome: "roupa-de-cama" },
    { id: 1016, nome: "protetor" },
  ];

  // Reclassifica produtos que o Magento devolve numa categoria errada
  // (ex: roupa de cama aparecendo dentro de travesseiros).
  const CATEGORY_KEYWORDS: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /lencol|len[cç]ol|jogo\s*de\s*cama|edredom|coberdrom|cobertor|fronha|colcha|sobre.?lencol/i, category: "roupa-de-cama" },
    { pattern: /protetor|impermeavel|imperm[eé]avel/i, category: "protetor" },
    { pattern: /travesseiro|pillow/i, category: "travesseiros" },
    { pattern: /cama\s*box\s*\+?\s*colch[aã]o|box\s*\+?\s*colch|colch[aã]o\s*\+?\s*box/i, category: "cama-box-colchao" },
    { pattern: /cama\s*box(?!\s*\+?\s*colch)/i, category: "cama-box" },
    { pattern: /colch[aã]o/i, category: "colchoes" },
  ];

  function resolveCategory(nome: string, slug: string, crawlerCategory: string): string {
    const text = `${nome} ${slug}`.toLowerCase();
    for (const { pattern, category } of CATEGORY_KEYWORDS) {
      if (pattern.test(text)) return category;
    }
    return crawlerCategory;
  }

  const seenIds = new Set<number>();
  const seenSkus = new Set<string>();

  try {
    await atualizarStatus("running", "Buscando lojas ativas e produtos via API...", 0, 0);

    const lojasAtivas = await db
      .select({ id: lojasTable.id })
      .from(lojasTable)
      .where(eq(lojasTable.ativa, true));
    const lojaIds = lojasAtivas.length > 0 ? lojasAtivas.map(l => l.id) : [1];
    console.log(`[Crawler] Lojas ativas: ${lojaIds.join(", ")}`);

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
        const slug = item.url_key;
        const imagem = item.small_image?.url ?? "";
        let { familySlug, familyName, size } = extractFamilyInfo(slug, item.name);

        // Extract dimensions from description HTML
        const html = item.description?.html ?? "";
        const text = htmlToText(html);
        const medidasMatch = text.match(/(\d{2,3})\s*[xX×]\s*(\d{2,3})/);
        const medidas = medidasMatch ? `${medidasMatch[1]}x${medidasMatch[2]}` : "";
        const alturaMatch = text.match(/(\d{2,3})\s*cm/i);
        const altura = alturaMatch ? alturaMatch[0] : "";

        const largura = medidasMatch ? parseInt(medidasMatch[1], 10) : null;
        const comprimento = medidasMatch ? parseInt(medidasMatch[2], 10) : null;

        // Refine Solteiro classification by width when name-based detection is ambiguous
        if (size === "Solteiro" && largura) {
          if (largura >= 96 && largura <= 100) size = "Solteiro King" as typeof size;
          else if (largura >= 110 && largura <= 130) size = "Viúvo" as typeof size;
        }

        // Business rule: only Solteiro 88x188 is pronta_entrega; larger Solteiro variants are sob_encomenda
        const isSolteiroEncomenda = size === "Solteiro King" || size === "Viúvo";
        const encomenda = isSolteiroEncomenda;
        const deliveryStrategy = isSolteiroEncomenda ? "sob_encomenda" as const : "pronta_entrega" as const;

        // Descrição comercial completa (HTML preservado) + ficha técnica normalizada.
        const shortHtml = item.short_description?.html ?? "";
        const descricao = [shortHtml, html].filter(Boolean).join("\n") || null;
        const fichaTecnica = parseFichaTecnica(item);

        const categoriaReal = resolveCategory(item.name, slug, categoria.nome);

        // ── Dicionário Mestre de Medidas (SSOT) ────────────────────────────────
        // Classifica por MEDIDA, nunca por nome. A medida extraída da descrição
        // ("medidas") é a fonte primária; o título é fallback. O crawler apenas
        // CONSOME a Tabela Mestre — nunca a escreve.
        const classificacao = classificarDeTextoLivre(
          [medidas, item.name, altura].filter(Boolean).join(" "),
        );
        // Só colchões/cama-box têm medida de cama esperada. Travesseiros, protetores
        // e roupa de cama não têm tamanho de leito — ficam NAO_MAPEADA legitimamente
        // e são navegados por `categoria` (tipo de produto), não por tamanho.
        const esperaMedidaDeCama =
          categoriaReal === "colchoes" ||
          categoriaReal === "cama-box" ||
          categoriaReal === "cama-box-colchao";
        if (esperaMedidaDeCama && classificacao.categoria === "NAO_MAPEADA") {
          console.error(
            JSON.stringify({
              modulo: "crawler",
              evento: "produto_sem_medida_mapeada",
              sku: item.sku,
              nome: item.name,
              medidas: medidas || null,
              motivo: classificacao.motivo,
            }),
          );
        }
        // Quando classificado, o status da Tabela Mestre é a fonte de verdade para
        // pronta-entrega vs sob-encomenda (substitui a inferência por nome).
        const encomendaFinal = classificacao.status
          ? classificacao.status === "sob_encomenda"
          : encomenda;
        const deliveryStrategyFinal = classificacao.status
          ? (classificacao.status === "sob_encomenda"
              ? ("sob_encomenda" as const)
              : ("pronta_entrega" as const))
          : deliveryStrategy;

        const productValues = {
          nome: item.name,
          sku: item.sku,
          slug,
          link,
          preco,
          precoPix,
          precoBase: String(precoRegular),
          parcelamento: `12x de ${formatBRL(precoRegular / 12)}`,
          medidas: medidas || null,
          altura: altura || null,
          largura: classificacao.largura ?? largura,
          comprimento: classificacao.comprimento ?? comprimento,
          // SSOT: medida canônica + categoria de tamanho + status derivados da MEDIDA.
          medida: classificacao.medida,
          categoriaInterna: classificacao.categoria,
          statusMedida: classificacao.status,
          categoria: categoriaReal,
          imagem: imagem || null,
          familySlug,
          familyName,
          size,
          encomenda: encomendaFinal,
          deliveryStrategy: deliveryStrategyFinal,
          descricao,
          fichaTecnica,
          disponivel: true,
          sincronizadoEm: syncStart,
        };

        let savedAtLeastOne = false;
        for (const lid of lojaIds) {
          try {
            await db.insert(produtosTable).values({
              lojaId: lid,
              ...productValues,
            }).onConflictDoUpdate({
              target: [produtosTable.sku, produtosTable.lojaId],
              targetWhere: sql`${produtosTable.sku} IS NOT NULL`,
              set: productValues,
            });
            savedAtLeastOne = true;
          } catch (err) {
            console.error(`[Crawler] Erro ao salvar ${item.name} para loja ${lid}:`, err);
          }
        }
        if (savedAtLeastOne) {
          produtosColetados++;
        } else {
          erros++;
        }

        if (produtosColetados % 10 === 0) {
          await atualizarStatus("running", `Salvando ${categoria.nome} — ${produtosColetados}/${totalEstimado}`, produtosColetados, erros, totalEstimado);
        }
      }
    }

    // Soft-delete products not seen in this sync cycle (supplier removed them).
    // Never hard-deletes — history and outlet items are preserved.
    //
    // GUARD: só roda se ao menos 1 produto foi salvo com sucesso. Numa falha sistêmica
    // (ex.: coluna ausente, GraphQL fora do ar) todos os inserts falham e produtosColetados=0;
    // sem este guard, o soft-delete marcaria TODO o catálogo como indisponível.
    if (produtosColetados > 0) {
      let totalSoftDeleted = 0;
      for (const lid of lojaIds) {
        const softDeleted = await db
          .update(produtosTable)
          .set({ disponivel: false })
          .where(and(
            lt(produtosTable.sincronizadoEm, syncStart) as ReturnType<typeof lt>,
            eq(produtosTable.lojaId, lid),
          ))
          .returning({ id: produtosTable.id });
        totalSoftDeleted += softDeleted.length;
        if (softDeleted.length > 0) {
          console.log(`[Crawler] Soft-deleted ${softDeleted.length} products for loja ${lid}.`);
        }
      }
      console.log(`[Crawler] Total soft-deleted: ${totalSoftDeleted} products.`);
    } else {
      console.error(`[Crawler] Nenhum produto salvo (erros=${erros}) — soft-delete PULADO para não zerar o catálogo.`);
    }

    if (produtosColetados === 0) {
      await atualizarStatus("error", `Falha: 0 produtos salvos, ${erros} erros. Catálogo preservado.`, produtosColetados, erros, 0, true);
      console.log(`[Crawler] Finalizado COM FALHA: 0 produtos, ${erros} erros`);
      return;
    }

    const nonStdMarked = await markNonStandardProducts();
    if (nonStdMarked > 0) {
      console.log(`[Crawler] Marked ${nonStdMarked} non-standard dimension products as encomenda`);
    }

    for (const lid of lojaIds) {
      try {
        const result = await sincronizarMetaCatalogo(lid);
        console.log(JSON.stringify({ event: "crawler_meta_sync_done", lojaId: lid, sincronizados: result.sincronizados, erros: result.erros }));
      } catch (err) {
        console.log(JSON.stringify({ event: "crawler_meta_sync_skip", lojaId: lid, reason: err instanceof Error ? err.message : String(err) }));
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

// Resets stale "running" status left by a killed process (e.g. after server restart).
router.post("/resetar", requireDono, async (_req, res) => {
  crawlerRunning = false;
  await db.update(crawlerStatusTable)
    .set({ status: "idle", mensagem: "Resetado manualmente.", atualizadoEm: new Date() })
    .where(eq(crawlerStatusTable.status, "running"));
  res.json({ ok: true, mensagem: "Status do crawler resetado para idle." });
});

export { crawlerRunning };
export default router;
