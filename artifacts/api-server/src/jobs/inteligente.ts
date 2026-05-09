import { db } from "@workspace/db";
import { orcamentosTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { enviarWhatsApp } from "../services/whatsapp.js";
import type { TenantKey } from "../config/tenants.js";

const TENANT_LOJA: Record<TenantKey, number> = {
  "cabo-frio": 1,
  "araruama": 2,
  "default": 1,
};

const TENANTS: TenantKey[] = ["cabo-frio", "araruama"];

// Follow-up para orçamentos pendentes há mais de 24h
async function followUpOrcamentosPendentes(): Promise<void> {
  const limite = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const tenant of TENANTS) {
    const pendentes = await db
      .select({
        id: orcamentosTable.id,
        cliente: orcamentosTable.cliente,
        whatsapp: orcamentosTable.whatsapp,
        criadoEm: orcamentosTable.criadoEm,
      })
      .from(orcamentosTable)
      .where(
        and(
          eq(orcamentosTable.lojaId, TENANT_LOJA[tenant] ?? 1),
          eq(orcamentosTable.status, "pendente"),
          lt(orcamentosTable.criadoEm, limite)
        )
      );

    for (const orc of pendentes) {
      if (!orc.whatsapp) continue;

      try {
        await enviarWhatsApp(
          orc.whatsapp,
          `Olá, ${orc.cliente}! Vi que você ainda não finalizou seu pedido. Posso te ajudar com alguma dúvida? 😊`
        );
        console.log(`[Job] Follow-up enviado: orcamento #${orc.id} tenant=${tenant}`);
      } catch (err) {
        console.error(`[Job] Erro no follow-up orcamento #${orc.id}:`, err);
      }
    }
  }
}

let jobHandle: ReturnType<typeof setInterval> | null = null;

export function iniciarJobInteligente(): void {
  if (jobHandle) return;

  // Executa a cada 30 minutos
  jobHandle = setInterval(
    () => {
      followUpOrcamentosPendentes().catch((err) =>
        console.error("[Job] Erro no job inteligente:", err)
      );
    },
    30 * 60 * 1000
  );

  console.log("[Job] Job inteligente iniciado (intervalo: 30min)");
}

export function pararJobInteligente(): void {
  if (jobHandle) {
    clearInterval(jobHandle);
    jobHandle = null;
    console.log("[Job] Job inteligente parado");
  }
}
