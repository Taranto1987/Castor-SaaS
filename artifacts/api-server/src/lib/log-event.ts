import type { Response } from "express";
import { db } from "@workspace/db";
import { eventosOperacionaisTable } from "@workspace/db/schema";
import { logger } from "./logger";

export interface LogEventParams {
  lojaId: number;
  entidade: string;
  entidadeId?: string;
  acao: string;
  atorId?: number;
  atorTipo?: "usuario" | "agente" | "sistema";
  payload?: Record<string, unknown>;
  res?: Response;
}

/**
 * Records a domain event to the audit trail.
 * Never throws — a logging failure must not crash the caller's request.
 */
export async function logEvent({
  lojaId,
  entidade,
  entidadeId,
  acao,
  atorId,
  atorTipo = "sistema",
  payload,
  res,
}: LogEventParams): Promise<void> {
  try {
    const correlationId = res?.locals?.["correlationId"] as string | undefined;
    const requestId = res?.locals?.["requestId"] as string | undefined;

    await db.insert(eventosOperacionaisTable).values({
      lojaId,
      entidade,
      entidadeId: entidadeId ?? null,
      acao,
      atorId: atorId ?? null,
      atorTipo,
      payload: payload ?? null,
      correlationId: correlationId ?? null,
      requestId: requestId ?? null,
    });
  } catch (err) {
    logger.error({ err, entidade, acao }, "logEvent failed — audit row not written");
  }
}
