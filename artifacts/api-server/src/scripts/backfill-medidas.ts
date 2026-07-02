/**
 * BACKFILL — Dicionário Mestre de Medidas
 *
 * Para cada produto já existente no banco, classifica por MEDIDA (nunca por nome)
 * via classificarDeTextoLivre(medidas + nome) e preenche as colunas derivadas:
 *   medida, largura, comprimento, categoria_interna, status_medida.
 *
 * Produtos de colchão/cama-box que caírem em NAO_MAPEADA vão para um relatório de
 * revisão manual (impressos ao final) e NÃO aparecem no catálogo — o filtro de
 * catálogo exclui categoria_interna = 'NAO_MAPEADA'. Travesseiros/protetores/roupa
 * de cama não têm medida de leito e permanecem NAO_MAPEADA legitimamente (navegados
 * por `categoria`, não por tamanho).
 *
 * Idempotente: re-rodar recalcula os mesmos valores. Seguro rodar várias vezes.
 *
 * Rodar manualmente:
 *   pnpm --filter @workspace/api-server run backfill-medidas
 */
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { classificarDeTextoLivre } from "../medidas";

const CATEGORIAS_COM_MEDIDA_DE_CAMA = new Set([
  "colchoes",
  "cama-box",
  "cama-box-colchao",
]);

interface ItemRevisao {
  id: number;
  nome: string;
  categoria: string;
  medidas: string | null;
  motivo?: string;
}

async function run(): Promise<void> {
  console.log("[backfill-medidas] Iniciando...");

  const produtos = await db
    .select({
      id: produtosTable.id,
      nome: produtosTable.nome,
      categoria: produtosTable.categoria,
      medidas: produtosTable.medidas,
      altura: produtosTable.altura,
    })
    .from(produtosTable);

  console.log(`[backfill-medidas] ${produtos.length} produtos para processar.`);

  let classificados = 0;
  let naoMapeados = 0;
  const revisaoManual: ItemRevisao[] = [];

  for (const p of produtos) {
    const entrada = [p.medidas, p.nome, p.altura].filter(Boolean).join(" ");
    const r = classificarDeTextoLivre(entrada);

    await db
      .update(produtosTable)
      .set({
        medida: r.medida,
        largura: r.largura,
        comprimento: r.comprimento,
        categoriaInterna: r.categoria,
        statusMedida: r.status,
      })
      .where(eq(produtosTable.id, p.id));

    if (r.categoria === "NAO_MAPEADA") {
      naoMapeados++;
      // Só entra no relatório de revisão se DEVERIA ter medida de cama.
      if (CATEGORIAS_COM_MEDIDA_DE_CAMA.has(p.categoria)) {
        revisaoManual.push({
          id: p.id,
          nome: p.nome,
          categoria: p.categoria,
          medidas: p.medidas,
          motivo: r.motivo,
        });
      }
    } else {
      classificados++;
    }
  }

  console.log(
    `[backfill-medidas] Concluído — classificados=${classificados} nao_mapeados=${naoMapeados}`,
  );

  if (revisaoManual.length > 0) {
    console.log(
      `\n[backfill-medidas] ⚠️  ${revisaoManual.length} colchões/cama-box SEM medida mapeada — REVISÃO MANUAL:`,
    );
    for (const item of revisaoManual) {
      console.log(
        JSON.stringify({
          evento: "revisao_manual_medida",
          id: item.id,
          categoria: item.categoria,
          medidas: item.medidas,
          motivo: item.motivo,
          nome: item.nome.slice(0, 90),
        }),
      );
    }
    console.log(
      "[backfill-medidas] Estes produtos NÃO aparecem no catálogo até terem medida válida na Tabela Mestre.",
    );
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-medidas] Fatal:", err);
  process.exit(1);
});
