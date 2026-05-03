import Anthropic from "@anthropic-ai/sdk";

const BETA_HEADER = "managed-agents-2026-04-01";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultHeaders: { "anthropic-beta": BETA_HEADER },
});

const AGENT_ID = process.env.CASTOR_AGENT_ID!;
const ENVIRONMENT_ID = process.env.CASTOR_ENVIRONMENT_ID!;

export async function runCastorAgent(message: string): Promise<{ sessionId: string; text: string; status: string }> {
  const session = await (client as any).beta.sessions.create({
    agent: AGENT_ID,
    environment_id: ENVIRONMENT_ID,
  });
  return runOnExistingSession(session.id, message);
}

export async function runOnExistingSession(sessionId: string, message: string): Promise<{ sessionId: string; text: string; status: string }> {
  await (client as any).beta.sessions.events.send(sessionId, {
    events: [{ type: "user.message", content: [{ type: "text", text: message }] }],
  });

  let text = "";
  let status = "running";
  const stream = await (client as any).beta.sessions.events.stream(sessionId);

  for await (const event of stream) {
    if (event?.type === "agent.message") {
      for (const block of (event.content ?? [])) {
        if (block?.type === "text") text += block.text;
      }
    }
    if (event?.type === "session.status_idle") { status = "idle"; break; }
    if (event?.type === "session.status_terminated") { status = "terminated"; break; }
  }

  return { sessionId, text: text.trim(), status };
}
