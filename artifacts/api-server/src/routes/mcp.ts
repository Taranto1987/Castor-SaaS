import { Router } from "express";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createCastorMcpServer } from "../lib/mcp/server";
import { resolveLojaId } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// Stateless MCP endpoint — each request creates a fresh server+transport pair.
// Supports: GET (SSE stream), POST (JSON-RPC), DELETE (session teardown).
router.all("/mcp", async (req: Request, res: Response) => {
  const lojaId = resolveLojaId(req);
  const start = Date.now();
  const method = typeof req.body?.method === "string" ? req.body.method : req.method;

  logger.info({ lojaId, method, ip: req.ip }, "mcp request");

  const server = createCastorMcpServer(lojaId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    logger.info({ lojaId, method, latencyMs: Date.now() - start }, "mcp request completed");
  } catch (err) {
    logger.error({ err, lojaId, method, latencyMs: Date.now() - start }, "MCP request error");
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP server error" });
    }
  }
});

export default router;
