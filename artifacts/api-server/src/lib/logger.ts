import pino from "pino";
import type { Response } from "express";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  ...(process.env["NODE_ENV"] !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
});

/** Returns a child logger pre-bound with lojaId + correlationId from res.locals. */
export function routeLogger(res: Response, lojaId: number) {
  const locals = res.locals as Record<string, unknown>;
  return logger.child({
    lojaId,
    requestId: locals["requestId"] ?? locals["correlationId"],
  });
}
