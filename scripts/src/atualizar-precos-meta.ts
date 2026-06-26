// Run: META_ACCESS_TOKEN=xxx pnpm --filter @workspace/scripts run atualizar-precos-meta

const META_API_VERSION = "v19.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface ProdutoUpdate {
  product_id: string;
  nome: string;
  preco_atual_centavos: number;
  novo_preco_centavos: number;
}

interface Resultado {
  product_id: string;
  nome: string;
  status: "ok" | "erro" | "pulado";
  preco_anterior?: string;
  novo_preco?: string;
  error?: string;
}

// Preencha novo_preco_centavos com o valor correto antes de rodar.
// Produtos com novo_preco_centavos === 0 são ignorados.
// Preço em centavos: R$ 3.395,00 = 339500
const PRODUTOS: ProdutoUpdate[] = [
  { product_id: "26965712579742942", nome: "Cama Box + Colchão Casal Silver Star Air One Face Híbrido 138x188x59cm", preco_atual_centavos: 339500, novo_preco_centavos: 0 },
  { product_id: "26945082198469997", nome: "Cama Box + Colchão King Premium Amazon Gel One Face Pocket 193x203x59cm", preco_atual_centavos: 599000, novo_preco_centavos: 0 },
  { product_id: "8838602569485642", nome: "Colchão Solteiro Silver Star Air One Face Híbrido 88x188x32cm", preco_atual_centavos: 179900, novo_preco_centavos: 0 },
  { product_id: "8657591824271626", nome: "Colchão Casal Silver Star Air One Face Híbrido 138x188x32cm", preco_atual_centavos: 259000, novo_preco_centavos: 0 },
  { product_id: "8522047044482645", nome: "Conjunto Class New Pocket® One Face", preco_atual_centavos: 289000, novo_preco_centavos: 0 },
  { product_id: "8485596271484082", nome: "Cama Box + Colchão Queen New Class One Face Pocket 158x198x52cm", preco_atual_centavos: 349000, novo_preco_centavos: 0 },
  { product_id: "8430466240325234", nome: "Cama Box + Colchão Queen Silver Star Air One Face Híbrido 158x198x59cm", preco_atual_centavos: 429000, novo_preco_centavos: 0 },
  { product_id: "8393449164068911", nome: "Cama Box Baú Queen Vellus Cinza 158x198x35cm", preco_atual_centavos: 269000, novo_preco_centavos: 0 },
  { product_id: "8308304619249038", nome: "Colchão Queen Silver Star Air One Face Híbrido 158x198x32cm", preco_atual_centavos: 319000, novo_preco_centavos: 0 },
  { product_id: "8241312532623394", nome: "Colchão King Silver Star Air One Face Híbrido 193x203x32cm", preco_atual_centavos: 419000, novo_preco_centavos: 0 },
  { product_id: "8031329426965767", nome: "Cama Box Baú Queen Vellus Bege 158x198x35cm", preco_atual_centavos: 279000, novo_preco_centavos: 0 },
  { product_id: "7569264893176080", nome: "Cama Box + Colchão Casal Premium Amazon Gel One Face Pocket 138x188x59cm", preco_atual_centavos: 389000, novo_preco_centavos: 0 },
  { product_id: "7535025993266969", nome: "Cama Box + Colchão Solteiro Silver Star Air One Face Híbrido 88x188x59cm", preco_atual_centavos: 248000, novo_preco_centavos: 0 },
];

function centavosToMeta(centavos: number): string {
  const reais = (centavos / 100).toFixed(2);
  return `${reais} BRL`;
}

function centavosToDisplay(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function atualizarPreco(
  produto: ProdutoUpdate,
  accessToken: string,
): Promise<Resultado> {
  const url = `${META_BASE_URL}/${produto.product_id}`;
  const priceStr = centavosToMeta(produto.novo_preco_centavos);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: priceStr,
        access_token: accessToken,
      }),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errorMsg = (data as { error?: { message?: string } }).error?.message
        ?? `HTTP ${response.status}`;
      console.log(JSON.stringify({
        event: "price_update",
        product_id: produto.product_id,
        nome: produto.nome,
        status: "erro",
        error: errorMsg,
      }));
      return {
        product_id: produto.product_id,
        nome: produto.nome,
        status: "erro",
        preco_anterior: centavosToDisplay(produto.preco_atual_centavos),
        novo_preco: centavosToDisplay(produto.novo_preco_centavos),
        error: errorMsg,
      };
    }

    console.log(JSON.stringify({
      event: "price_update",
      product_id: produto.product_id,
      nome: produto.nome,
      preco_anterior: centavosToDisplay(produto.preco_atual_centavos),
      novo_preco: centavosToDisplay(produto.novo_preco_centavos),
      status: "ok",
    }));

    return {
      product_id: produto.product_id,
      nome: produto.nome,
      status: "ok",
      preco_anterior: centavosToDisplay(produto.preco_atual_centavos),
      novo_preco: centavosToDisplay(produto.novo_preco_centavos),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({
      event: "price_update",
      product_id: produto.product_id,
      nome: produto.nome,
      status: "erro",
      error: errorMsg,
    }));
    return {
      product_id: produto.product_id,
      nome: produto.nome,
      status: "erro",
      error: errorMsg,
    };
  }
}

async function run() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("[atualizar-precos-meta] META_ACCESS_TOKEN não definido.");
    console.error("Uso: META_ACCESS_TOKEN=xxx pnpm --filter @workspace/scripts run atualizar-precos-meta");
    process.exit(1);
  }

  const produtosParaAtualizar = PRODUTOS.filter((p) => p.novo_preco_centavos > 0);

  if (produtosParaAtualizar.length === 0) {
    console.error("[atualizar-precos-meta] Nenhum produto com novo_preco_centavos > 0.");
    console.error("Edite o array PRODUTOS no script e preencha os novos preços.");
    process.exit(1);
  }

  console.log(`[atualizar-precos-meta] Atualizando ${produtosParaAtualizar.length} de ${PRODUTOS.length} produtos...\n`);

  const resultados: Resultado[] = [];

  for (let i = 0; i < produtosParaAtualizar.length; i++) {
    const produto = produtosParaAtualizar[i];
    const resultado = await atualizarPreco(produto, accessToken);
    resultados.push(resultado);

    if (i < produtosParaAtualizar.length - 1) {
      await delay(200);
    }
  }

  const atualizados = resultados.filter((r) => r.status === "ok").length;
  const erros = resultados.filter((r) => r.status === "erro").length;

  console.log("\n--- RESUMO ---");
  console.table(
    resultados.map((r) => ({
      Produto: r.nome.substring(0, 60),
      "Preço Anterior": r.preco_anterior ?? "-",
      "Novo Preço": r.novo_preco ?? "-",
      Status: r.status === "ok" ? "✓" : `✗ ${r.error ?? ""}`,
    })),
  );

  console.log(`\nTotal: ${atualizados} atualizados, ${erros} erros`);
  process.exit(erros > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("[atualizar-precos-meta] Fatal:", err);
  process.exit(1);
});
