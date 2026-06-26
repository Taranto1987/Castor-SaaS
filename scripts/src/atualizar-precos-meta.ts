// Sincroniza preços lojacastor.com.br → catálogo Meta (WhatsApp).
// Crawlea preços via Magento GraphQL e atualiza via Graph API.
// Zero dependência de banco de dados.
//
// Run: META_ACCESS_TOKEN=xxx pnpm --filter @workspace/scripts run atualizar-precos-meta

const META_API_VERSION = "v19.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const MAGENTO_GQL_URL = "https://lojacastor.com.br/graphql";
const MAGENTO_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Store": "castor",
};

interface CrawledProduct {
  name: string;
  sku: string;
  price: number;
}

interface MetaProduct {
  product_id: string;
  nome: string;
  preco_meta_centavos: number;
  match: { family: string; medidas: string };
}

interface Resultado {
  product_id: string;
  nome: string;
  status: "atualizado" | "igual" | "erro" | "sem_match";
  preco_meta?: string;
  preco_site?: string;
  error?: string;
}

const META_PRODUTOS: MetaProduct[] = [
  { product_id: "26965712579742942", nome: "Cama Box + Colchão Casal Silver Star Air One Face Híbrido 138x188x59cm", preco_meta_centavos: 339500, match: { family: "Silver Star Air", medidas: "138x188" } },
  { product_id: "26945082198469997", nome: "Cama Box + Colchão King Premium Amazon Gel One Face Pocket 193x203x59cm", preco_meta_centavos: 599000, match: { family: "Premium Amazon Gel", medidas: "193x203" } },
  { product_id: "8838602569485642", nome: "Colchão Solteiro Silver Star Air One Face Híbrido 88x188x32cm", preco_meta_centavos: 179900, match: { family: "Silver Star Air", medidas: "88x188" } },
  { product_id: "8657591824271626", nome: "Colchão Casal Silver Star Air One Face Híbrido 138x188x32cm", preco_meta_centavos: 259000, match: { family: "Silver Star Air", medidas: "138x188" } },
  { product_id: "8522047044482645", nome: "Conjunto Class New Pocket® One Face", preco_meta_centavos: 289000, match: { family: "Class New", medidas: "138x188" } },
  { product_id: "8485596271484082", nome: "Cama Box + Colchão Queen New Class One Face Pocket 158x198x52cm", preco_meta_centavos: 349000, match: { family: "Class New", medidas: "158x198" } },
  { product_id: "8430466240325234", nome: "Cama Box + Colchão Queen Silver Star Air One Face Híbrido 158x198x59cm", preco_meta_centavos: 429000, match: { family: "Silver Star Air", medidas: "158x198" } },
  { product_id: "8393449164068911", nome: "Cama Box Baú Queen Vellus Cinza 158x198x35cm", preco_meta_centavos: 269000, match: { family: "Vellus", medidas: "158x198" } },
  { product_id: "8308304619249038", nome: "Colchão Queen Silver Star Air One Face Híbrido 158x198x32cm", preco_meta_centavos: 319000, match: { family: "Silver Star Air", medidas: "158x198" } },
  { product_id: "8241312532623394", nome: "Colchão King Silver Star Air One Face Híbrido 193x203x32cm", preco_meta_centavos: 419000, match: { family: "Silver Star Air", medidas: "193x203" } },
  { product_id: "8031329426965767", nome: "Cama Box Baú Queen Vellus Bege 158x198x35cm", preco_meta_centavos: 279000, match: { family: "Vellus", medidas: "158x198" } },
  { product_id: "7569264893176080", nome: "Cama Box + Colchão Casal Premium Amazon Gel One Face Pocket 138x188x59cm", preco_meta_centavos: 389000, match: { family: "Premium Amazon Gel", medidas: "138x188" } },
  { product_id: "7535025993266969", nome: "Cama Box + Colchão Solteiro Silver Star Air One Face Híbrido 88x188x59cm", preco_meta_centavos: 248000, match: { family: "Silver Star Air", medidas: "88x188" } },
];

// Categorias do Magento que contêm os 13 produtos
const CATEGORIAS = [
  { id: 3, nome: "colchoes" },
  { id: 5, nome: "cama-box-colchao" },
  { id: 6, nome: "cama-box" },
];

function centavosToDisplay(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Crawl lojacastor.com.br ---

function buildGqlQuery(categoryId: number): string {
  return `{
    products(
      filter: { category_id: { eq: "${categoryId}" } }
      pageSize: 48
      currentPage: 1
    ) {
      items {
        name
        sku
        price_range {
          minimum_price {
            regular_price { value }
          }
        }
      }
    }
  }`;
}

async function crawlCategoria(categoryId: number, categoryName: string): Promise<CrawledProduct[]> {
  try {
    const response = await fetch(MAGENTO_GQL_URL, {
      method: "POST",
      headers: MAGENTO_HEADERS,
      body: JSON.stringify({ query: buildGqlQuery(categoryId) }),
    });

    if (!response.ok) {
      console.error(`[crawl] Erro HTTP ${response.status} na categoria ${categoryName}`);
      return [];
    }

    const json = (await response.json()) as {
      data?: {
        products?: {
          items?: Array<{
            name: string;
            sku: string;
            price_range: { minimum_price: { regular_price: { value: number } } };
          }>;
        };
      };
    };

    const items = json.data?.products?.items;
    if (!items) return [];

    return items
      .filter((item) => item.sku && item.name)
      .map((item) => ({
        name: item.name,
        sku: item.sku,
        price: item.price_range.minimum_price.regular_price.value,
      }));
  } catch (err) {
    console.error(`[crawl] Falha na categoria ${categoryName}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

async function crawlAllProducts(): Promise<CrawledProduct[]> {
  const all: CrawledProduct[] = [];
  const seenSkus = new Set<string>();

  for (const cat of CATEGORIAS) {
    console.log(`[crawl] Buscando categoria: ${cat.nome} (ID ${cat.id})...`);
    const products = await crawlCategoria(cat.id, cat.nome);
    for (const p of products) {
      if (!seenSkus.has(p.sku)) {
        seenSkus.add(p.sku);
        all.push(p);
      }
    }
    await delay(300);
  }

  console.log(`[crawl] Total: ${all.length} produtos únicos crawleados.\n`);
  return all;
}

// --- Match crawled → Meta ---

function findMatch(meta: MetaProduct, crawled: CrawledProduct[]): CrawledProduct | null {
  const familyLower = meta.match.family.toLowerCase();
  const medidas = meta.match.medidas;

  // Para Vellus (Cama Box Baú), o nome do Meta inclui cor (Cinza/Bege).
  // Extraímos a cor do nome Meta para disambiguar.
  const isVellus = familyLower === "vellus";
  let cor = "";
  if (isVellus) {
    const corMatch = meta.nome.match(/Vellus\s+(Cinza|Bege)/i);
    cor = corMatch ? corMatch[1].toLowerCase() : "";
  }

  // O nome Meta indica o tipo de produto (Colchão vs Cama Box + Colchão vs Cama Box Baú)
  const isColchaoOnly = meta.nome.startsWith("Colchão ");
  const isCamaBoxBau = meta.nome.startsWith("Cama Box Baú");

  const candidates = crawled.filter((p) => {
    const nameLower = p.name.toLowerCase();
    if (!nameLower.includes(familyLower)) return false;
    if (!nameLower.includes(medidas.toLowerCase()) && !p.name.includes(medidas)) return false;
    if (isVellus && cor && !nameLower.includes(cor)) return false;
    return true;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Disambiguar por tipo de produto
  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    if (isColchaoOnly && cName.startsWith("colchão ") && !cName.includes("cama box")) return c;
    if (isCamaBoxBau && cName.includes("baú")) return c;
    if (!isColchaoOnly && !isCamaBoxBau && cName.includes("cama box") && !cName.includes("baú") && cName.includes("colchão")) return c;
  }

  return candidates[0];
}

// --- Atualizar Meta ---

async function atualizarPrecoMeta(
  productId: string,
  precoReais: number,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${META_BASE_URL}/${productId}`;
  const priceStr = `${precoReais.toFixed(2)} BRL`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price: priceStr, access_token: accessToken }),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const msg = (data as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Main ---

async function run() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[sync-meta] META_ACCESS_TOKEN não definido.");
    console.error("Uso: META_ACCESS_TOKEN=xxx pnpm --filter @workspace/scripts run atualizar-precos-meta");
    process.exit(1);
  }

  // 1. Crawl preços do site
  console.log("[sync-meta] Crawleando preços de lojacastor.com.br...\n");
  const crawled = await crawlAllProducts();

  if (crawled.length === 0) {
    console.error("[sync-meta] Nenhum produto crawleado. Verifique conectividade com lojacastor.com.br.");
    process.exit(1);
  }

  // 2. Match + atualizar
  console.log(`[sync-meta] Comparando ${META_PRODUTOS.length} produtos Meta com dados do site...\n`);
  const resultados: Resultado[] = [];

  for (let i = 0; i < META_PRODUTOS.length; i++) {
    const meta = META_PRODUTOS[i];
    const matched = findMatch(meta, crawled);

    if (!matched) {
      console.log(JSON.stringify({ event: "price_sync", product_id: meta.product_id, nome: meta.nome, status: "sem_match" }));
      resultados.push({ product_id: meta.product_id, nome: meta.nome, status: "sem_match" });
      continue;
    }

    const precSiteCentavos = Math.round(matched.price * 100);

    if (precSiteCentavos === meta.preco_meta_centavos) {
      console.log(JSON.stringify({ event: "price_sync", product_id: meta.product_id, nome: meta.nome, status: "igual", preco: centavosToDisplay(precSiteCentavos) }));
      resultados.push({
        product_id: meta.product_id, nome: meta.nome, status: "igual",
        preco_meta: centavosToDisplay(meta.preco_meta_centavos),
        preco_site: centavosToDisplay(precSiteCentavos),
      });
      continue;
    }

    const result = await atualizarPrecoMeta(meta.product_id, matched.price, accessToken);

    console.log(JSON.stringify({
      event: "price_sync", product_id: meta.product_id, nome: meta.nome,
      preco_meta: centavosToDisplay(meta.preco_meta_centavos),
      preco_site: centavosToDisplay(precSiteCentavos),
      status: result.ok ? "atualizado" : "erro",
      ...(result.error ? { error: result.error } : {}),
    }));

    resultados.push({
      product_id: meta.product_id, nome: meta.nome,
      status: result.ok ? "atualizado" : "erro",
      preco_meta: centavosToDisplay(meta.preco_meta_centavos),
      preco_site: centavosToDisplay(precSiteCentavos),
      ...(result.error ? { error: result.error } : {}),
    });

    if (i < META_PRODUTOS.length - 1) await delay(200);
  }

  // 3. Resumo
  const atualizados = resultados.filter((r) => r.status === "atualizado").length;
  const iguais = resultados.filter((r) => r.status === "igual").length;
  const erros = resultados.filter((r) => r.status === "erro").length;
  const semMatch = resultados.filter((r) => r.status === "sem_match").length;

  console.log("\n--- RESUMO ---");
  console.table(
    resultados.map((r) => ({
      Produto: r.nome.substring(0, 55),
      Meta: r.preco_meta ?? "-",
      Site: r.preco_site ?? "-",
      Status: r.status === "atualizado" ? "✓ atualizado"
        : r.status === "igual" ? "= igual"
        : r.status === "sem_match" ? "? sem match"
        : `✗ ${r.error ?? "erro"}`,
    })),
  );

  console.log(`\nTotal: ${atualizados} atualizados, ${iguais} iguais, ${erros} erros, ${semMatch} sem match`);
  process.exit(erros > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("[sync-meta] Fatal:", err);
  process.exit(1);
});
