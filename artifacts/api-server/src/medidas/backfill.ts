/**
 * BACKFILL — Dicionário Mestre de Medidas (função compartilhada)
 *
 * Classifica por MEDIDA (nunca por nome) os produtos ainda não classificados
 * (categoria_interna IS NULL) via classificarDeTextoLivre(medidas + nome) e
 * preenche as colunas derivadas. Usada tanto pelo boot (auto-alinhamento após
 * deploy) quanto pelo script CLI manual.
 *
 * Idempotente e one-shot: o guard `categoria_interna IS NULL` garante que cada
 * linha é processada uma única vez — após o backfill toda linha tem um valor
 * não-nulo (NAO_MAPEADA para as sem medida válida), então não reprocessa no
 * próximo boot.
 */
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq, isNull } from "drizzle-orm";
import { classificarDeTextoLivre } from "./classificador";

const CATEGORIAS_COM_MEDIDA_DE_CAMA = new Set([
  "colchoes",
  "cama-box",
  "cama-box-colchao",
]);

export interface ItemRevisaoMedida {
  id: number;
  nome: string;
  categoria: string;
  medidas: string | null;
  motivo?: string;
}

export interface ResultadoBackfillMedidas {
  processados: number;
  classificados: number;
  naoMapeados: number;
  revisaoManual: ItemRevisaoMedida[];
}

/**
 * Processa apenas produtos com categoria_interna IS NULL (ainda não classificados).
 * Passe { forcarTodos: true } para reprocessar a base inteira (uso manual/CLI).
 */
export async function backfillMedidasProdutos(
  opts: { forcarTodos?: boolean } = {},
): Promise<ResultadoBackfillMedidas> {
  const base = db
    .select({
      id: produtosTable.id,
      nome: produtosTable.nome,
      categoria: produtosTable.categoria,
      medidas: produtosTable.medidas,
      altura: produtosTable.altura,
    })
    .from(produtosTable);

  const produtos = opts.forcarTodos
    ? await base
    : await base.where(isNull(produtosTable.categoriaInterna));

  let classificados = 0;
  let naoMapeados = 0;
  const revisaoManual: ItemRevisaoMedida[] = [];

  for (const p of produtos) {
    const entrada = [p.medidas, p.nome, p.altura].filter(Boolean).join(" ");
    const r = classificarDeTextoLivre(entrada);

    await db
      .update(produtosTable)
      .set({
        medida: r.medida,
        largura: r.largura,
        comprimento: r.comprimento,
        categoriaInterna: r.categoria, // sempre não-nulo (NAO_MAPEADA no pior caso)
        statusMedida: r.status,
      })
      .where(eq(produtosTable.id, p.id));

    if (r.categoria === "NAO_MAPEADA") {
      naoMapeados++;
      // Só entra na revisão manual se DEVERIA ter medida de cama (colchão/cama-box).
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

  return {
    processados: produtos.length,
    classificados,
    naoMapeados,
    revisaoManual,
  };
}
