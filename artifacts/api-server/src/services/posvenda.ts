import { db } from "@workspace/db";
import { followUpsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { enviarWhatsApp } from "./whatsapp";
import { logEvent } from "../lib/log-event";

/** Normaliza telefone para o formato 55DDDNUMERO; null se inválido. */
function sanitizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function mensagemPosVenda(cliente: string, produtos: string | null): string {
  const nome = primeiroNome(cliente);
  const item = produtos ? ` (${produtos})` : "";
  return `Oi ${nome}! 🛏️ Aqui é da Castor.\n\nSeu pedido${item} foi entregue! Esperamos que aproveite muito. 😊\n\nMe conta: deu tudo certo com a entrega e o produto? Sua opinião ajuda demais — e se puder deixar uma avaliação, a gente agradece de coração! ⭐`;
}

export interface EntregaPosVenda {
  id: number;
  orcamentoId: number | null;
  cliente: string;
  whatsapp: string | null;
  produtos: string | null;
}

/**
 * Pós-venda disparado quando a entrega é concluída.
 * Envia a mensagem de satisfação/avaliação (degrada se o WhatsApp não estiver
 * configurado), registra em follow_ups (histórico) e emite evento. Idempotente.
 * Nunca lança — não deve quebrar a atualização de status da entrega.
 */
export async function dispararPosVenda(entrega: EntregaPosVenda, lojaId: number): Promise<void> {
  try {
    // Idempotência: não duplica pós-venda para o mesmo orçamento
    if (entrega.orcamentoId) {
      const existente = await db
        .select({ id: followUpsTable.id })
        .from(followUpsTable)
        .where(and(eq(followUpsTable.orcamentoId, entrega.orcamentoId), eq(followUpsTable.tipo, "POS_VENDA")))
        .limit(1);
      if (existente.length > 0) return;
    }

    const tel = sanitizarTelefone(entrega.whatsapp);
    const mensagem = mensagemPosVenda(entrega.cliente, entrega.produtos);
    const waLink = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}` : null;

    let enviado = false;
    if (tel) {
      try {
        await enviarWhatsApp(tel, mensagem, lojaId);
        enviado = true;
      } catch (err) {
        // WhatsApp (Evolution/WAHA) não configurado — registra mesmo assim, com waLink manual
        console.error("[posvenda] envio automático indisponível (WhatsApp não configurado):", err);
      }
    }

    // Registra no histórico de follow-ups (FK exige orcamentoId)
    if (entrega.orcamentoId) {
      await db.insert(followUpsTable).values({
        lojaId,
        orcamentoId: entrega.orcamentoId,
        tipo: "POS_VENDA",
        mensagem,
        waLink,
        executadoEm: new Date(), // one-shot no momento da entrega (não vai para a fila do scheduler)
      });
    }

    await logEvent({
      lojaId,
      entidade: "entrega",
      entidadeId: String(entrega.id),
      acao: "POS_VENDA_INICIADA",
      payload: { enviado, orcamentoId: entrega.orcamentoId },
    });
  } catch (err) {
    console.error("[posvenda] falha ao disparar pós-venda:", err);
  }
}

/** Emite um evento de logística para a trilha de eventos operacionais. */
export async function emitirEventoEntrega(
  lojaId: number,
  entregaId: number,
  orcamentoId: number | null,
  acao: string,
): Promise<void> {
  await logEvent({
    lojaId,
    entidade: "entrega",
    entidadeId: String(entregaId),
    acao,
    payload: orcamentoId ? { orcamentoId } : undefined,
  });
}
