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
import { resolveOrCreateCustomer, stitchIdentityByPhone } from "../services/memory/identity";
import { loadCapsule, buildStateBlock, generateAndSaveCapsule } from "../services/memory/capsule";
import { extractSessionSignals } from "../services/scoring/signals";
import { scheduleLeadScoreUpdate } from "../services/scoring/updater";
import { CASTOR_ALL_TOOLS } from "../lib/tools/definitions";
import { runTools } from "../lib/tool-runner";
import type { ToolContext } from "../lib/tools/context";
import { logger } from "../lib/logger";

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
        console.log(`[Memory] Customer ${customerId} | capsule: ${capsuleState ? "yes" : "no"} | sessions: ${capsuleState?.sessionCount ?? 0}`);
      } catch (err) {
        console.error("[Memory] Identity resolution failed:", err);
      }
    }

    if (!client) {
      sendSSE(res, { content: buildFallbackMessage() });
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

    // ── Tool-aware streaming ──────────────────────────────────────────────────
    // Pass 1: streaming with tools. If the model calls a tool we buffer and
    // don't forward to SSE; then we execute the tools and stream pass 2.
    // If no tool use, text is forwarded directly — zero latency penalty.

    let hasToolUse = false;
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemBlocks,
      messages: chatMessages,
      tools: CASTOR_ALL_TOOLS,
    });

    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") hasToolUse = true;
    });

    stream.on("text", (text) => {
      if (!hasToolUse) {
        fullAssistantText += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    });

    const firstResponse = await stream.finalMessage();

    if (firstResponse.stop_reason === "tool_use") {
      const toolBlocks = firstResponse.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      const toolCtx: ToolContext = {
        lojaId,
        requestId: (res.locals as Record<string, unknown>)["requestId"] as string | undefined,
        actorType: "agente",
      };
      const toolResults = await runTools(toolBlocks, toolCtx);

      // Pass 2: stream final answer with tool results injected
      const stream2 = client.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemBlocks,
        messages: [
          ...chatMessages,
          { role: "assistant" as const, content: firstResponse.content },
          { role: "user" as const, content: toolResults },
        ],
        // No tools on second call — prevents recursion
      });

      stream2.on("text", (text) => {
        fullAssistantText += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      });

      const finalMsg2 = await stream2.finalMessage();
      logger.info({
        lojaId,
        sessionId,
        pass: 2,
        inputTokens: finalMsg2.usage.input_tokens,
        outputTokens: finalMsg2.usage.output_tokens,
        cacheReadTokens: (finalMsg2.usage as unknown as Record<string, number>)["cache_read_input_tokens"] ?? 0,
        cacheCreationTokens: (finalMsg2.usage as unknown as Record<string, number>)["cache_creation_input_tokens"] ?? 0,
      }, "chat token usage");
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    logger.info({
      lojaId,
      sessionId,
      pass: 1,
      inputTokens: firstResponse.usage.input_tokens,
      outputTokens: firstResponse.usage.output_tokens,
      cacheReadTokens: (firstResponse.usage as unknown as Record<string, number>)["cache_read_input_tokens"] ?? 0,
      cacheCreationTokens: (firstResponse.usage as unknown as Record<string, number>)["cache_creation_input_tokens"] ?? 0,
      hasToolUse,
    }, "chat token usage");

    if (hasToolUse) {
      logger.info({ lojaId, sessionId, tools: firstResponse.content.filter(b => b.type === "tool_use").map(b => b.type === "tool_use" ? b.name : "") }, "chat tools used");
    }

    // fire-and-forget post-processing
    setImmediate(() => {
      (async () => {
        // Classify the full conversation for richer signal extraction
        const allUserText = chatMessages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join(" ");
        const classification = classifyMessage(allUserText);

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

          // Phone stitching: links this device to any existing customer with the same phone,
          // enabling cross-device identity continuity when the user provides their number.
          if (customerId && lead.telefone) {
            await stitchIdentityByPhone(customerId, lead.telefone, lead.nomeCliente, lojaId);
          }
        }

        // Generate relational state capsule — include the current assistant response so
        // even a single-exchange conversation produces a valid capsule for the next session.
        if (customerId) {
          const messagesForCapsule: ChatMessage[] = [
            ...chatMessages,
            ...(fullAssistantText ? [{ role: "assistant" as const, content: fullAssistantText }] : []),
          ];
          await generateAndSaveCapsule(
            customerId,
            lojaId,
            messagesForCapsule,
            capsuleState?.capsule ?? null,
            capsuleState?.sessionCount ?? 0
          );
        }

        // update lead score from this session's signals
        if (customerId) {
          const sessionSignals = extractSessionSignals(
            chatMessages,
            classification,
            capsuleState,
            productIds,
            !!(lead?.deveSalvar),
          );
          const nextSessionCount = (capsuleState?.sessionCount ?? 0) + 1;
          scheduleLeadScoreUpdate(customerId, lojaId, sessionSignals, nextSessionCount, chatMessages.length);
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
