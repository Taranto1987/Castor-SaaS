import { db } from "@workspace/db";
import { despesasTable, despesasRecorrentesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

async function gerarRecorrentesMes(mes: number, ano: number): Promise<number> {
  const recorrentes = await db
    .select()
    .from(despesasRecorrentesTable)
    .where(eq(despesasRecorrentesTable.ativo, true));

  let geradas = 0;

  for (const r of recorrentes) {
    const existente = await db
      .select()
      .from(despesasTable)
      .where(
        and(
          eq(despesasTable.recorrenteId, r.id),
          eq(despesasTable.categoria, r.categoria)
        )
      );

    const jaExiste = existente.some((e) => {
      const d = new Date(e.data);
      return d.getMonth() + 1 === mes && d.getFullYear() === ano;
    });

    if (!jaExiste) {
      const dia = Math.min(r.diaVencimento, new Date(ano, mes, 0).getDate());
      const data = new Date(ano, mes - 1, dia);

      await db.insert(despesasTable).values({
        lojaId: r.lojaId ?? 1,
        valor: r.valor,
        categoria: r.categoria,
        descricao: r.descricao ? `${r.descricao} (auto)` : `${r.categoria} (auto)`,
        recorrente: true,
        recorrenteId: r.id,
        confirmada: false,
        data,
      });
      geradas++;
    }
  }

  return geradas;
}

let _recorrentesHandle: ReturnType<typeof setInterval> | null = null;

export function iniciarSchedulerRecorrentes(): void {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  gerarRecorrentesMes(mes, ano)
    .then((geradas) => {
      if (geradas > 0) {
        console.log(`[Recorrentes] ${geradas} despesa(s) recorrente(s) gerada(s) automaticamente para ${mes}/${ano}`);
      }
    })
    .catch((err) => {
      console.error("[Recorrentes] Erro ao gerar recorrentes:", err);
    });

  const MS_PER_HOUR = 60 * 60 * 1000;
  _recorrentesHandle = setInterval(() => {
    const agora = new Date();
    if (agora.getHours() === 0 && agora.getMinutes() < 2) {
      const m = agora.getMonth() + 1;
      const a = agora.getFullYear();
      gerarRecorrentesMes(m, a)
        .then((g) => {
          if (g > 0) console.log(`[Recorrentes] ${g} despesa(s) gerada(s) para ${m}/${a}`);
        })
        .catch((err) => console.error("[Recorrentes] Erro:", err));
    }
  }, MS_PER_HOUR);
}

export function stopSchedulerRecorrentes(): void {
  if (_recorrentesHandle) {
    clearInterval(_recorrentesHandle);
    _recorrentesHandle = null;
  }
}
