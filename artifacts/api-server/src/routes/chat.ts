import { Router } from "express";
import type { Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getProductContext } from "../services/chat/repository";
import { processarLeadDaConversa } from "../services/chat/lead-extractor";
import { SYSTEM_PROMPT, buildFallbackMessage } from "../services/chat/prompt";
import type { ChatMessage } from "../services/chat/lead-extractor";
import { resolveLojaId } from "../middlewares/auth";
import { emitEvent } from "../services/events/emit";
import { classifyMessage, extractProductIds } from "../services/events/classifier";
import { resolveOrCreateCustomer, mergePhoneIdentity } from "../services/memory/identity";
import { loadCapsule, buildStateBlock, generateAndSaveCapsule } from "../services/memory/capsule";

const router = Router();

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new Anthropic({ baseURL: "https://api.anthropic.com", apiKey });
}

function sendSSE(res: Response, payload: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.post("/", async (req, res) => {
  try {
    const { messages, sessionId: clientSessionId, anonymousId } = req.body as {
      messages: ChatMessage[];
      sessionId?: string;
      anonymousId?: string;
    };
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const sessionId = clientSessionId ?? crypto.randomUUID();
    const lojaId = resolveLojaId(req);

    const chatMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const lastUserMessage =
      [...chatMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const client = getAnthropicClient();

    emitEvent({ type: "session_started", sessionId, lojaId, messageCount: chatMessages.length });

    // resolve relational memory (only on first message of a session to avoid extra DB round-trips)
    let customerId: number | null = null;
    let capsuleState: Awaited<ReturnType<typeof loadCapsule>> = null;
    let customerName: string | null = null;

    if (anonymousId) {
      try {
        customerId = await resolveOrCreateCustomer(anonymousId, lojaId);
        capsuleState = await loadCapsule(customerId);
      } catch (err) {
        console.error("[Memory] Identity resolution failed:", err);
      }
    }

    if (!client) {
      sendSSE(res, { content: buildFallbackMessage(lastUserMessage) });
      sendSSE(res, { done: true });
      res.end();
      return;
    }

    const productContext = await getProductContext(lojaId);
    let fullAssistantText = "";

    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: productContext },
    ];

    // inject relational state only when there's meaningful history (>1 session)
    if (capsuleState && capsuleState.sessionCount >= 1) {
      const stateBlock = buildStateBlock(customerName, capsuleState);
      systemBlocks.push({ type: "text", text: stateBlock });
    }

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemBlocks,
      messages: chatMessages,
    });

    stream.on("text", (text) => {
      fullAssistantText += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    });

    await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    // fire-and-forget post-processing
    setImmediate(() => {
      (async () => {
        const classification = classifyMessage(lastUserMessage);

        if (classification.pains.length > 0 || classification.intent !== "low" || classification.objections.length > 0) {
          emitEvent({ type: "intent_classified", sessionId, lojaId, ...classification });
        }
        for (const pain of classification.pains) {
          emitEvent({ type: "pain_detected", sessionId, lojaId, pain });
        }
        for (const objection of classification.objections) {
          emitEvent({ type: "objection_detected", sessionId, lojaId, objection });
        }
        if (classification.intent === "high" || classification.intent === "closing") {
          emitEvent({ type: "high_intent_detected", sessionId, lojaId });
        }
        const productIds = extractProductIds(fullAssistantText);
        if (productIds.length > 0) {
          emitEvent({ type: "product_recommended", sessionId, lojaId, productIds });
        }

        const lead = await processarLeadDaConversa(chatMessages, fullAssistantText);
        if (lead?.deveSalvar) {
          emitEvent({
            type: "lead_captured",
            sessionId,
            lojaId,
            hasName: !!lead.nomeCliente,
            hasPhone: !!lead.telefone,
            productIds: lead.produtoIds,
          });

          // merge phone into customer identity when captured
          if (customerId && lead.telefone) {
            await mergePhoneIdentity(customerId, lead.telefone, lead.nomeCliente);
          }
        }

        // generate relational state capsule at end of session
        if (customerId) {
          await generateAndSaveCapsule(
            customerId,
            lojaId,
            chatMessages,
            capsuleState?.capsule ?? null,
            capsuleState?.sessionCount ?? 0
          );
        }
      })().catch((err) => console.error("[Chat] Post-processing error:", err));
    });
  } catch (error) {
    console.error("Chat error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro interno do chat" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Erro ao processar mensagem" })}\n\n`);
      res.end();
    }
  }
});

export default router;
