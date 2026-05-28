import Anthropic from "@anthropic-ai/sdk";

const AGENT_ID = process.env.CASTOR_AGENT_ID || "agent_011CaUZvcdTX3LxfnopZE9Cw";
const ENVIRONMENT_ID = process.env.CASTOR_ENVIRONMENT_ID || "env_0111U769QLZaYYpabKFRacWM";
const BETAS = ["managed-agents-2026-04-01"] as const;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("[castor-agent] ANTHROPIC_API_KEY não configurada");
  return new Anthropic({ apiKey });
}

export async function createCastorSession(title?: string) {
  const client = getClient();
  return await (client as any).beta.sessions.create(
    {
      agent: AGENT_ID,
      environment_id: ENVIRONMENT_ID,
      title: title ?? `castor-${Date.now()}`,
    },
    { betas: BETAS },
  );
}

export async function sendCastorMessage(sessionId: string, content: string) {
  const client = getClient();
  return await (client as any).beta.sessions.events.send(
    sessionId,
    {
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: content }],
        },
      ],
    },
    { betas: BETAS },
  );
}

export async function streamCastorEvents(sessionId: string) {
  const client = getClient();
  return await (client as any).beta.sessions.events.stream(
    { session_id: sessionId },
    { betas: BETAS },
  );
}

export async function getCastorSession(sessionId: string) {
  const client = getClient();
  return await (client as any).beta.sessions.retrieve(sessionId, {
    betas: BETAS,
  });
}
