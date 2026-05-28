import { db, toolExecutionsTable } from "@workspace/db";
import { logger } from "./logger";

export interface ToolExecutionLog {
  lojaId: number;
  toolName: string;
  source: "chat" | "mcp";
  status: "success" | "error" | "timeout";
  durationMs: number;
  inputSummary?: Record<string, unknown>;
  errorMessage?: string;
  correlationId?: string;
  requestId?: string;
}

export function logToolExecution(params: ToolExecutionLog): void {
  setImmediate(async () => {
    try {
      await db.insert(toolExecutionsTable).values(params);
    } catch (err) {
      logger.error({ err }, "Failed to log tool execution");
    }
  });
}
