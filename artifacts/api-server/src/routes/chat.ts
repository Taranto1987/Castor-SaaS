import { Router } from "express";
import type { Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getProductContextCompact } from "../services/chat/repository";
import { processarLeadDaConversa } from "../services/chat/lead-extractor";
import { SYSTEM_PROMPT, buildFallbackMessage, buildSessionIntentBlock } from "../services/chat/prompt";
import type { ChatMessage } from "../services/chat/lead-extractor";
import { resolvePublicLojaId } from "../middlewares/auth";
import { emitEvent } from "../services/events/emit";
import { classifyMessage, extractProductIds } from "../services/events/classifier";
import { resolveOrCreateCustomer, stitchIdentityByPhone } from "../services/memory/identity";
import { loadCapsule, buildStateBlock, generateAndSaveCapsule } from "../services/memory/capsule";
import { extractSessionSignals } from "../services/scoring/signals";
import { scheduleLeadScoreUpdate } from "../services/scoring/updater";
import { CASTOR_READ_TOOLS } from "../lib/tools/definitions";
import { runTools } from "../lib/tool-runner";
import { logger, routeLogger } from "../lib/logger";
import { generateAndSaveLeadContext } from "../services/lead-context";

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
    const lojaId = resolvePublicLojaId(req);
    const log = routeLogger(res, lojaId);

    const ac = new AbortController();
    req.on("close", () => ac.abort());

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

    let fullAssistantText = "";

    // Block 1: static prefix — immutable, cross-tenant cache hit every request
    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ];

    // Block 2: compact product memory — ~60 tokens, no cache needed
    const compactHints = await getProductContextCompact(lojaId);
    systemBlocks.push({ type: "text", text: compactHints });

    // Block 3: longTerm relational state — only for returning customers (sessionCount >= 1)
    if (capsuleState && capsuleState.sessionCount >= 1) {
      systemBlocks.push({ type: "text", text: buildStateBlock(customerName, capsuleState) });
    }

    // Block 4: shortTerm intent signals — only when current session has meaningful signals
    const intentBlock = buildSessionIntentBlock(chatMessages);
    if (intentBlock) {
      systemBlocks.push({ type: "text", text: intentBlock });
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
      tools: CASTOR_READ_TOOLS,
    }, { signal: ac.signal });

    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") hasToolUse = true;
    });

    stream.on("text", (text) => {
      if (!hasToolUse) {
        if (res.writableEnded || ac.signal.aborted) return;
        fullAssistantText += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    });

    const firstResponse = await stream.finalMessage();

    if (firstResponse.stop_reason === "tool_use") {
      const toolBlocks = firstResponse.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      const toolResults = await runTools(toolBlocks, lojaId, {
        correlationId: (res.locals as Record<string, unknown>)["correlationId"] as string | undefined,
        requestId: (res.locals as Record<string, unknown>)["requestId"] as string | undefined,
      });

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
      }, { signal: ac.signal });

      stream2.on("text", (text) => {
        if (res.writableEnded || ac.signal.aborted) return;
        fullAssistantText += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      });

      await stream2.finalMessage();
    }

    if (!res.writableEnded && !ac.signal.aborted) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }
    if (!res.writableEnded) res.end();

    log.info({
      sessionId,
      model: "claude-sonnet-4-6",
      inputTokens: firstResponse.usage.input_tokens,
      outputTokens: firstResponse.usage.output_tokens,
      cacheReadTokens: firstResponse.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: firstResponse.usage.cache_creation_input_tokens ?? 0,
      hasToolUse,
    }, "ai_usage");

    if (hasToolUse) {
      log.info({ tools: firstResponse.content.filter(b => b.type === "tool_use").map(b => b.type === "tool_use" ? b.name : "") }, "chat tools used");
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

          // Sync lead context so WhatsApp path inherits this web conversation's knowledge.
          if (lead.telefone) {
            const allMessages = [
              ...chatMessages,
              ...(fullAssistantText ? [{ role: "assistant" as const, content: fullAssistantText }] : []),
            ];
            setImmediate(() => {
              generateAndSaveLeadContext(lead.telefone!, lojaId, lead.nomeCliente ?? null, allMessages)
                .catch((err) => logger.error({ err }, "lead context sync failed"));
            });
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
