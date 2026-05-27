import { Router } from "express";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createCastorMcpServer } from "../lib/mcp/server";
import { resolvePublicLojaId } from "../middlewares/auth";
import { getSession } from "../lib/sessions";
import { logger } from "../lib/logger";
import type { ToolContext } from "../lib/tools/context";

const router = Router();

// Stateless MCP endpoint — each request creates a fresh server+transport pair.
// Supports: GET (SSE stream), POST (JSON-RPC), DELETE (session teardown).
router.all("/mcp", async (req: Request, res: Response) => {
  const lojaId = resolvePublicLojaId(req);
  const start = Date.now();
  const method = typeof req.body?.method === "string" ? req.body.method : req.method;

  const token = (req.headers["x-session-token"] || "") as string;
  const session = token ? getSession(token) : null;

  const ctx: ToolContext = {
    lojaId: session ? session.lojaId : lojaId,
    requestId: (res.locals as Record<string, unknown>)["requestId"] as string | undefined,
    actorId: session?.userId,
    actorType: session ? "usuario" : "agente",
    vendedor: session?.nome,
  };

  logger.info({ lojaId: ctx.lojaId, method, ip: req.ip, authenticated: !!session }, "mcp request");

  const server = createCastorMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    logger.info({ lojaId: ctx.lojaId, method, latencyMs: Date.now() - start }, "mcp request completed");
  } catch (err) {
    logger.error({ err, lojaId: ctx.lojaId, method, latencyMs: Date.now() - start }, "MCP request error");
    if (!res.headersSent) {
      res.status(500).json({ error: "MCP server error" });
    }
  }
});

export default router;
