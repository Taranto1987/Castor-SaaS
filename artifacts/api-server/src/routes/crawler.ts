import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { produtosTable, crawlerStatusTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { chromium } from "playwright";

const router: IRouter = Router();

let crawlerRunning = false;

async function getCrawlerStatus() {
  const results = await db.select().from(crawlerStatusTable).orderBy(crawlerStatusTable.id).limit(1);
  if (results.length === 0) {
    return {
      status: "idle" as const,
      mensagem: "Aguardando início da coleta",
      totalProdutos: 0,
      produtosColetados: 0,
      erros: 0,
    };
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

async function atualizarStatus(status: string, mensagem: string, produtosColetados: number, erros: number, finalizado = false) {
  const existing = await db.select({ id: crawlerStatusTable.id }).from(crawlerStatusTable).limit(1);

  const data = {
    status,
    mensagem,
    produtosColetados: String(produtosColetados),
    erros: String(erros),
    atualizadoEm: new Date(),
    ...(finalizado ? { finalizadoEm: new Date() } : {}),
  };

  if (existing.length === 0) {
    await db.insert(crawlerStatusTable).values({
      ...data,
      totalProdutos: "0",
      iniciadoEm: new Date(),
    });
  } else {
    await db.update(crawlerStatusTable).set(data).where(eq(crawlerStatusTable.id, existing[0].id));
  }
}

async function executarCrawler() {
  crawlerRunning = true;
  let produtosColetados = 0;
  let erros = 0;

  const categorias = [
    { url: "https://lojacastor.com.br/colchoes", nome: "colchoes" },
    { url: "https://lojacastor.com.br/cama-box", nome: "cama-box" },
    { url: "https://lojacastor.com.br/cama-box-colch-o", nome: "cama-box-colchao" },
    { url: "https://lojacastor.com.br/travesseiros", nome: "travesseiros" },
    { url: "https://lojacastor.com.br/roupa-de-cama", nome: "roupa-de-cama" },
    { url: "https://lojacastor.com.br/roupa-de-cama/protetor", nome: "protetor" },
  ];

  await atualizarStatus("running", "Iniciando navegador...", 0, 0);

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();

    for (const categoria of categorias) {
      await atualizarStatus("running", `Coletando categoria: ${categoria.nome}`, produtosColetados, erros);

      let pagina = 1;
      while (true) {
        const url = `${categoria.url}?p=${pagina}`;
        try {
          await page.goto(url, { timeout: 60000 });
          await page.waitForTimeout(3000);

          const links = await page.$$eval(
            "a.product-item-link",
            (els: Element[]) => els.map((e: Element) => (e as HTMLAnchorElement).href)
          );

          if (links.length === 0) break;

          for (const link of links) {
            const p = await browser.newPage();
            try {
              await p.goto(link, { timeout: 60000 });
              await p.waitForTimeout(2000);

              let nome = "", sku = "", preco = "", precoPix = "", parcelamento = "", medidas = "", altura = "", imagem = "";

              try { nome = (await p.locator("h1").first().textContent() ?? "").trim(); } catch {}
              try { preco = (await p.locator(".price").first().textContent() ?? "").trim(); } catch {}
              try {
                const pixEl = p.locator("text=/Pix/i").first();
                precoPix = (await pixEl.textContent() ?? "").trim();
              } catch {}
              try {
                const parcEl = p.locator("text=/x de/").first();
                parcelamento = (await parcEl.textContent() ?? "").trim();
              } catch {}
              try {
                const refEl = p.locator("text=/Ref/i").first();
                sku = (await refEl.textContent() ?? "").trim();
              } catch {}
              try {
                const desc = await p.locator(".product.attribute.description").textContent() ?? "";
                const m1 = desc.match(/\d{2,3}x\d{2,3}/);
                if (m1) medidas = m1[0];
                const m2 = desc.match(/(\d{2,3})\s*cm/);
                if (m2) altura = m2[0];
              } catch {}
              try { imagem = (await p.locator("img.gallery-placeholder__image").first().getAttribute("src") ?? ""); } catch {
                try { imagem = (await p.locator("img").first().getAttribute("src") ?? ""); } catch {}
              }

              if (nome) {
                await db.insert(produtosTable).values({
                  nome,
                  sku: sku || null,
                  preco: preco || null,
                  precoPix: precoPix || null,
                  parcelamento: parcelamento || null,
                  medidas: medidas || null,
                  altura: altura || null,
                  categoria: categoria.nome,
                  imagem: imagem || null,
                  link,
                });
                produtosColetados++;
                await atualizarStatus("running", `Coletado: ${nome.substring(0, 60)}`, produtosColetados, erros);
              }
            } catch (err) {
              erros++;
              console.error(`Erro ao coletar ${link}:`, err);
            } finally {
              await p.close();
            }
          }

          pagina++;
        } catch (err) {
          console.error(`Erro na página ${url}:`, err);
          erros++;
          break;
        }
      }
    }

    await atualizarStatus("completed", `Coleta finalizada! ${produtosColetados} produtos coletados.`, produtosColetados, erros, true);
  } catch (error) {
    console.error("Erro no crawler:", error);
    await atualizarStatus("error", `Erro: ${String(error)}`, produtosColetados, erros, true);
  } finally {
    if (browser) await browser.close();
    crawlerRunning = false;
  }
}

router.post("/iniciar", async (_req, res) => {
  if (crawlerRunning) {
    res.json({
      status: "running",
      mensagem: "Crawler já está em execução",
      totalProdutos: 0,
      produtosColetados: 0,
      erros: 0,
    });
    return;
  }

  const existing = await db.select({ id: crawlerStatusTable.id }).from(crawlerStatusTable).limit(1);
  const initData = {
    status: "running",
    mensagem: "Iniciando...",
    totalProdutos: "0",
    produtosColetados: "0",
    erros: "0",
    iniciadoEm: new Date(),
    atualizadoEm: new Date(),
    finalizadoEm: null,
  };

  if (existing.length === 0) {
    await db.insert(crawlerStatusTable).values(initData);
  } else {
    await db.update(crawlerStatusTable).set(initData).where(eq(crawlerStatusTable.id, existing[0].id));
  }

  executarCrawler().catch(console.error);

  res.json({
    status: "running",
    mensagem: "Crawler iniciado! Aguarde a coleta.",
    totalProdutos: 0,
    produtosColetados: 0,
    erros: 0,
    iniciadoEm: new Date().toISOString(),
  });
});

router.get("/status", async (_req, res) => {
  try {
    const status = await getCrawlerStatus();
    res.json(status);
  } catch (error) {
    console.error("Erro ao buscar status:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
