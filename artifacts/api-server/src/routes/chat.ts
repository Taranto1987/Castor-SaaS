import { Router } from "express";
import type { Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getProductContextCompact } from "../services/chat/repository";
import { processarLeadDaConversa } from "../services/chat/lead-extractor";
import { SYSTEM_PROMPT, buildFallbackMessage, buildSessionIntentBlock, buildDiagnosticBlock } from "../services/chat/prompt";
import { buildRecommendationFallback } from "../services/chat/fallback";
import { db } from "@workspace/db";
import { diagnosticosTable, sleepOutcomesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
import { trackAIUsage } from "../lib/ai-usage";

const router = Router();

function extractPhoneFromText(text: string): string | null {
  const match = text.match(/\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/);
  if (match) return match[0].replace(/\D/g, "");
  const digits = text.match(/\b(\d{10,11})\b/);
  return digits ? digits[1] : null;
}

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

    const chatMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Cancel the Anthropic stream if the client disconnects early
    const ac = new AbortController();
    req.on("close", () => ac.abort());

    const client = getAnthropicClient();

    emitEvent({ type: "session_started", sessionId, lojaId, messageCount: chatMessages.length });

    // resolve relational memory (only on first message of a session to avoid extra DB round-trips)
    let customerId: number | null = null;
    let capsuleState: Awaited<ReturnType<typeof loadCapsule>> = null;
    let customerName: string | null = null;

    if (anonymousId) {
      try {
        const profile = await resolveOrCreateCustomer(anonymousId, lojaId);
        customerId = profile.id;
        customerName = profile.name;
        capsuleState = await loadCapsule(customerId);
        console.log(`[Memory] Customer ${customerId} | name: ${customerName ?? "unknown"} | capsule: ${capsuleState ? "yes" : "no"} | sessions: ${capsuleState?.sessionCount ?? 0}`);
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
    let toolProductIds: number[] = [];
    let pass2InputTokens = 0, pass2OutputTokens = 0, pass2CacheRead = 0, pass2CacheWrite = 0;
    const sessionStart = Date.now();

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

    // Block 5: Diagnostic Twin context — only for customers who used Mapa do Sono
    if (customerId) {
      try {
        const [latestDiag] = await db
          .select()
          .from(diagnosticosTable)
          .where(and(eq(diagnosticosTable.customerId, customerId), eq(diagnosticosTable.lojaId, lojaId)))
          .orderBy(desc(diagnosticosTable.criadoEm))
          .limit(1);

        if (latestDiag) {
          const [latestOutcome] = await db
            .select()
            .from(sleepOutcomesTable)
            .where(eq(sleepOutcomesTable.diagnosticoId, latestDiag.id))
            .orderBy(desc(sleepOutcomesTable.criadoEm))
            .limit(1);

          systemBlocks.push({
            type: "text",
            text: buildDiagnosticBlock(latestDiag, latestOutcome ?? null),
          });
        }
      } catch (err) {
        console.error("[Memory] Diagnostic context load failed:", err);
      }
    }

    // ── Tool-aware streaming ──────────────────────────────────────────────────
    // Pass 1: buffer-then-flush. ALL text is buffered during streaming.
    // After finalMessage(): if no tool_use → flush buffer to client.
    // If tool_use → discard buffer (preamble like "Vou buscar!" never reaches client).
    // Pass 2 (post-tool) still streams live to the client.

    let hasToolUse = false;
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemBlocks,
      messages: chatMessages,
      tools: CASTOR_READ_TOOLS,
    }, { signal: ac.signal });

    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") hasToolUse = true;
    });

    let pass1Buffer = "";
    stream.on("text", (text) => {
      pass1Buffer += text;
    });

    const firstResponse = await stream.finalMessage();

    const userMessageTexts = chatMessages.filter(m => m.role === "user").map(m => m.content);

    // Flush Pass 1 buffer only when no tool was called
    if (!hasToolUse && firstResponse.stop_reason !== "tool_use") {
      if (!res.writableEnded && !ac.signal.aborted) {
        fullAssistantText = pass1Buffer;
        res.write(`data: ${JSON.stringify({ content: pass1Buffer })}\n\n`);
      }
    }

    if (firstResponse.stop_reason === "tool_use") {
      const toolBlocks = firstResponse.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      const toolResults = await runTools(toolBlocks, lojaId, {
        correlationId: (res.locals as Record<string, unknown>)["correlationId"] as string | undefined,
        requestId: (res.locals as Record<string, unknown>)["requestId"] as string | undefined,
      });

      for (const tr of toolResults) {
        if (typeof tr.content !== "string") continue;
        try {
          const data = JSON.parse(tr.content);
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item?.id && typeof item.id === "number") toolProductIds.push(item.id);
          }
        } catch { /* skip non-JSON */ }
      }

      // Pass 2: stream final answer with tool results injected
      const formattingReminder: Anthropic.Messages.TextBlockParam = {
        type: "text",
        text: "LEMBRETE DE FORMATAÇÃO: " +
          "Monte links usando os campos retornados: • [{familyName limpo}](/produto/{slug}) (Tamanho) — PIX: R$ X.XXX. " +
          "Limpe familyName removendo 'Colchão Castor', dimensões, 'Double Face' e tamanho. " +
          "Exemplo: • [Vitagel Max Anatomic Pocket](/produto/colchao-vitagel-solteiro) (Solteiro) — PIX: R$ 3.741,36. " +
          "Máximo 3 produtos com bullets (•). Links funcionam — NUNCA diga que não tem links.",
      };

      let pass2Text = "";
      try {
        const stream2 = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: systemBlocks,
          messages: [
            ...chatMessages,
            { role: "assistant" as const, content: firstResponse.content },
            { role: "user" as const, content: [...toolResults, formattingReminder] },
          ],
          // No tools on second call — prevents recursion
        }, { signal: ac.signal });

        stream2.on("text", (text) => {
          if (res.writableEnded || ac.signal.aborted) return;
          pass2Text += text;
          fullAssistantText += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        });

        const finalMsg2 = await stream2.finalMessage();
        pass2InputTokens = finalMsg2.usage.input_tokens;
        pass2OutputTokens = finalMsg2.usage.output_tokens;
        pass2CacheRead = (finalMsg2.usage as unknown as Record<string, number>)["cache_read_input_tokens"] ?? 0;
        pass2CacheWrite = (finalMsg2.usage as unknown as Record<string, number>)["cache_creation_input_tokens"] ?? 0;
        log.info({
          sessionId,
          pass: 2,
          inputTokens: pass2InputTokens,
          outputTokens: pass2OutputTokens,
          cacheReadTokens: pass2CacheRead,
          cacheCreationTokens: pass2CacheWrite,
        }, "chat token usage");
      } catch (err) {
        log.error({ err, sessionId }, "pass2_stream_failed");
      }

      // Contingência: nenhum lead termina sem recomendação. Se o Pass 2 falhou
      // ou veio vazio, entrega recomendação determinística com os dados reais
      // já obtidos das ferramentas nesta rodada.
      if (!pass2Text.trim() && !res.writableEnded && !ac.signal.aborted) {
        const fallback = await buildRecommendationFallback(toolResults, lojaId, userMessageTexts);
        fullAssistantText += fallback;
        res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
        log.warn({ sessionId, event: "pass2_fallback_sent" }, "pass2 empty — deterministic fallback sent");
      }
    } else if (hasToolUse) {
      // tool_use iniciado mas stop_reason !== "tool_use" (ex: max_tokens truncou
      // o bloco da ferramenta). Nenhum texto foi enviado ao cliente — entrega
      // fallback determinístico em vez de stream vazio.
      const fallback = await buildRecommendationFallback([], lojaId, userMessageTexts);
      fullAssistantText += fallback;
      if (!res.writableEnded && !ac.signal.aborted) {
        res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
      }
      log.warn({ sessionId, stopReason: firstResponse.stop_reason, event: "pass1_truncated_fallback" }, "tool_use truncated — deterministic fallback sent");
    }

    if (!res.writableEnded && !ac.signal.aborted) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }
    if (!res.writableEnded) res.end();

    const p1CacheRead  = firstResponse.usage.cache_read_input_tokens ?? 0;
    const p1CacheWrite = firstResponse.usage.cache_creation_input_tokens ?? 0;
    log.info({
      sessionId,
      model: "claude-sonnet-4-6",
      inputTokens: firstResponse.usage.input_tokens,
      outputTokens: firstResponse.usage.output_tokens,
      cacheReadTokens: p1CacheRead,
      cacheWriteTokens: p1CacheWrite,
      hasToolUse,
    }, "ai_usage");

    // Approximate pricing — verify at console.anthropic.com before billing decisions
    const INPUT_MTK = 3.0, OUTPUT_MTK = 15.0, CACHE_READ_MTK = 0.30, CACHE_WRITE_MTK = 3.75;
    const totalInput      = firstResponse.usage.input_tokens + pass2InputTokens;
    const totalOutput     = firstResponse.usage.output_tokens + pass2OutputTokens;
    const totalCacheRead  = p1CacheRead + pass2CacheRead;
    const totalCacheWrite = p1CacheWrite + pass2CacheWrite;
    const estimatedCostUsd = parseFloat((
      (totalInput      / 1e6) * INPUT_MTK  +
      (totalOutput     / 1e6) * OUTPUT_MTK +
      (totalCacheRead  / 1e6) * CACHE_READ_MTK +
      (totalCacheWrite / 1e6) * CACHE_WRITE_MTK
    ).toFixed(6));
    log.info({
      event: "session_complete",
      sessionId,
      durationMs: Date.now() - sessionStart,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCacheReadTokens: totalCacheRead,
      totalCacheWriteTokens: totalCacheWrite,
      estimatedCostUsd,
      hasToolUse,
      passes: hasToolUse ? 2 : 1,
    }, "session_complete");

    void trackAIUsage({
      lojaId,
      modelo: "claude-sonnet-4-6",
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheTokens: totalCacheRead + totalCacheWrite,
      custoEstimado: estimatedCostUsd,
      contexto: "chat",
      requestId: res.locals["requestId"] as string | undefined,
    });

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

        // Skip Haiku lead extraction for low-intent sessions — ~70% of messages produce no saveable lead
        const lead = classification.intent !== "low"
          ? await processarLeadDaConversa(chatMessages, fullAssistantText, lojaId, toolProductIds)
          : null;
        const leadPhone = lead?.telefone ?? extractPhoneFromText(allUserText);

        if (leadPhone) {
          if (customerId) {
            await stitchIdentityByPhone(customerId, leadPhone, lead?.nomeCliente ?? null, lojaId);
          }
          const allMessages = [
            ...chatMessages,
            ...(fullAssistantText ? [{ role: "assistant" as const, content: fullAssistantText }] : []),
          ];
          setImmediate(() => {
            generateAndSaveLeadContext(leadPhone, lojaId, lead?.nomeCliente ?? null, allMessages)
              .catch((err) => logger.error({ err }, "lead context sync failed"));
          });
        }

        if (lead?.deveSalvar) {
          emitEvent({
            type: "lead_captured",
            sessionId,
            lojaId,
            hasName: !!lead.nomeCliente,
            hasPhone: !!lead.telefone,
            productIds: lead.produtoIds,
          });
        }

        // Generate relational state capsule — skip for low-intent first sessions (no relational value)
        const isFirstSession = (capsuleState?.sessionCount ?? 0) === 0;
        const shouldGenerateCapsule = classification.intent !== "low" || !isFirstSession || chatMessages.length >= 5;
        if (customerId && shouldGenerateCapsule) {
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
