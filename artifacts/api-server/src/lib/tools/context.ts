/**
 * Execution context shared across all tool calls (read + write).
 * Injected server-side — never exposed to the model.
 */
export interface ToolContext {
  lojaId: number;
  requestId?: string;
  actorId?: number;
  actorType: "usuario" | "agente" | "sistema";
  vendedor?: string;
}
