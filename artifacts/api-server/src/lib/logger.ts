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

/** Returns a request-scoped child logger with lojaId attached. */
export function routeLogger(res: Response, lojaId?: number): typeof logger {
  const base = (res.locals["logger"] as typeof logger | undefined) ?? logger;
  return lojaId !== undefined ? base.child({ lojaId }) : base;
}
