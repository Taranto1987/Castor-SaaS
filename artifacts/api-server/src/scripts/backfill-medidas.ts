/**
 * BACKFILL CLI — Dicionário Mestre de Medidas
 *
 * Wrapper de linha de comando para backfillMedidasProdutos(). Reprocessa a base
 * inteira (forcarTodos) e imprime o relatório de revisão manual. A lógica de
 * classificação vive em src/medidas/backfill.ts (mesma função usada no boot).
 *
 * Rodar manualmente:
 *   pnpm --filter @workspace/api-server run backfill-medidas
 */
import { backfillMedidasProdutos } from "../medidas/backfill";

async function run(): Promise<void> {
  console.log("[backfill-medidas] Iniciando (reprocessando base inteira)...");

  const r = await backfillMedidasProdutos({ forcarTodos: true });

  console.log(
    `[backfill-medidas] Concluído — processados=${r.processados} classificados=${r.classificados} nao_mapeados=${r.naoMapeados}`,
  );

  if (r.revisaoManual.length > 0) {
    console.log(
      `\n[backfill-medidas] ⚠️  ${r.revisaoManual.length} colchões/cama-box SEM medida mapeada — REVISÃO MANUAL:`,
    );
    for (const item of r.revisaoManual) {
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
      "[backfill-medidas] Estes produtos NÃO aparecem em filtros por tamanho até terem medida válida na Tabela Mestre.",
    );
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("[backfill-medidas] Fatal:", err);
  process.exit(1);
});
