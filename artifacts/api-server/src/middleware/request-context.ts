import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomUUID();
  const correlationId =
    (req.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();

  res.locals["requestId"] = requestId;
  res.locals["correlationId"] = correlationId;

  // Expose to caller for distributed tracing
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Correlation-ID", correlationId);

  const start = Date.now();
  const reqLogger = logger.child({ requestId, correlationId });

  reqLogger.info({ method: req.method, path: req.path }, "→ request");

  res.on("finish", () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    reqLogger[level]({ status: res.statusCode, ms }, "← response");
  });

  next();
}
