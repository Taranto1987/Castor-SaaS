import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const AGENT_ID = process.env.CASTOR_AGENT_ID || "agent_011CaUZvcdTX3LxfnopZE9Cw";
const ENVIRONMENT_ID = process.env.CASTOR_ENVIRONMENT_ID || "env_0111U769QLZaYYpabKFRacWM";
const BETAS = ["managed-agents-2026-04-01"] as const;

export async function createCastorSession(title?: string) {
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
  return await (client as any).beta.sessions.events.stream(
    { session_id: sessionId },
    { betas: BETAS },
  );
}

export async function getCastorSession(sessionId: string) {
  return await (client as any).beta.sessions.retrieve(sessionId, {
    betas: BETAS,
  });
}
