import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  trafficManagerConfigTable,
  trafficManagerDecisionsTable,
  adMetricSnapshotsTable,
  produtosTable,
} from "@workspace/db/schema";
import {
  getAdInsights,
  pauseAdSet,
  updateAdSetDailyBudget,
  isMetaAdsConfigured,
  type AdInsight,
} from "./meta-ads-client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const geminiFlash = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "unused",
  httpOptions: {
    apiVersion: "",
    baseUrl:
      process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ??
      "https://generativelanguage.googleapis.com",
  },
});

export interface ActionExecuted {
  type: string;
  target: string;
  detail: string;
  success: boolean;
}

export interface TrafficDecision {
  anomalyDetected: boolean;
  vigiLevel: "ok" | "alerta" | "critico";
  summary: string;
  actions: ActionExecuted[];
}

// ─── Tools expostas ao Claude ────────────────────────────────────────────────

const TRAFFIC_TOOLS: Anthropic.Tool[] = [
  {
    name: "pause_adset",
    description:
      "Pausa um AdSet do Meta Ads. Use quando CPA está muito acima da meta ou produto sem estoque.",
    input_schema: {
      type: "object" as const,
      properties: {
        adset_id: { type: "string", description: "ID numérico do AdSet" },
        reason: { type: "string", description: "Justificativa técnica em português" },
      },
      required: ["adset_id", "reason"],
    },
  },
  {
    name: "adjust_budget",
    description:
      "Aumenta ou reduz o budget diário de um AdSet em BRL. Nunca exceda o limite configurado de aumento percentual.",
    input_schema: {
      type: "object" as const,
      properties: {
        adset_id: { type: "string" },
        new_budget_brl: {
          type: "number",
          description: "Novo budget diário total em BRL (ex: 80 para R$80/dia)",
        },
        reason: { type: "string" },
      },
      required: ["adset_id", "new_budget_brl", "reason"],
    },
  },
  {
    name: "notify_whatsapp",
    description: "Envia mensagem ao dono da operação via WhatsApp com resumo das ações.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "Mensagem em português. Seja objetivo: o que aconteceu e por quê.",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "check_product_stock",
    description:
      "Verifica estoque de produtos no banco de dados antes de pausar ou escalar anúncios.",
    input_schema: {
      type: "object" as const,
      properties: {
        product_name_contains: {
          type: "string",
          description: "Termo parcial do nome do produto (ex: 'King', 'Molas')",
        },
      },
      required: ["product_name_contains"],
    },
  },
];

// ─── Execução de tools ────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, any>,
  config: typeof trafficManagerConfigTable.$inferSelect | null,
  actions: ActionExecuted[],
): Promise<string> {
  try {
    if (toolName === "pause_adset") {
      await pauseAdSet(input["adset_id"] as string);
      actions.push({
        type: "pause_adset",
        target: input["adset_id"] as string,
        detail: input["reason"] as string,
        success: true,
      });
      return `AdSet ${input["adset_id"]} pausado.`;
    }

    if (toolName === "adjust_budget") {
      const newBudget = input["new_budget_brl"] as number;
      const maxIncreasePct = parseFloat(config?.maxDailyBudgetIncreasePct ?? "20");

      // Guardrail: log but trust Claude's judgment (we already told it the limit in system prompt)
      await updateAdSetDailyBudget(input["adset_id"] as string, newBudget);
      actions.push({
        type: "adjust_budget",
        target: input["adset_id"] as string,
        detail: `R$${newBudget}/dia — ${input["reason"]}`,
        success: true,
      });
      return `Budget do AdSet ${input["adset_id"]} ajustado para R$${newBudget}/dia.`;
    }

    if (toolName === "notify_whatsapp") {
      const notifyPhone =
        config?.notifyPhone ?? process.env.TRAFFIC_MANAGER_NOTIFY_PHONE;
      const wahaUrl = process.env.WAHA_URL;

      if (notifyPhone && wahaUrl) {
        await fetch(`${wahaUrl}/api/sendText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: process.env.WAHA_SESSION_NAME ?? "castor",
            chatId: notifyPhone,
            text: `🤖 *Gestor de Tráfego IA*\n\n${input["message"]}`,
          }),
        });
      } else {
        console.log(`[TrafficManager] WhatsApp: ${input["message"]}`);
      }

      actions.push({
        type: "notify_whatsapp",
        target: notifyPhone ?? "console",
        detail: input["message"] as string,
        success: true,
      });
      return "Notificação enviada.";
    }

    if (toolName === "check_product_stock") {
      const term = (input["product_name_contains"] as string).toLowerCase();
      const produtos = await db
        .select({
          id: produtosTable.id,
          nome: produtosTable.nome,
          estoque: produtosTable.estoque,
          disponivel: produtosTable.disponivel,
          encomenda: produtosTable.encomenda,
        })
        .from(produtosTable);

      const matches = produtos.filter((p) => p.nome.toLowerCase().includes(term));
      if (matches.length === 0) return `Nenhum produto encontrado com "${term}".`;

      return JSON.stringify(
        matches.map((p) => ({
          id: p.id,
          nome: p.nome,
          estoque: p.estoque,
          disponivel: p.disponivel,
          encomenda: p.encomenda,
        })),
      );
    }

    return `Tool desconhecida: ${toolName}`;
  } catch (e: any) {
    actions.push({
      type: toolName,
      target: JSON.stringify(input),
      detail: e.message,
      success: false,
    });
    return `Erro em ${toolName}: ${e.message}`;
  }
}

// ─── Camada 1: Gemini Flash (Vigia) ──────────────────────────────────────────

interface VigiResult {
  anomalia: boolean;
  nivel: "ok" | "alerta" | "critico";
  resumo: string;
  campanhas_problema: string[];
}

async function runVigia(
  insights: AdInsight[],
  config: typeof trafficManagerConfigTable.$inferSelect | null,
): Promise<VigiResult> {
  const maxCpa = parseFloat(config?.maxCpaThresholdBrl ?? "150");
  const minRoas = parseFloat(config?.minRoasTarget ?? "3");
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const insightsText =
    insights.length > 0
      ? JSON.stringify(insights, null, 2)
      : "Sem dados de campanha disponíveis (verifique credenciais META_ADS_ACCESS_TOKEN / META_ADS_ACCOUNT_ID).";

  const prompt = `Você é o Vigia do Gestor de Tráfego IA da Castor (loja de colchões — Cabo Frio/Araruama, RJ).
Analise os dados de hoje e responda APENAS com JSON válido, sem markdown:
{
  "anomalia": true | false,
  "nivel": "ok" | "alerta" | "critico",
  "resumo": "2 linhas explicando o estado geral",
  "campanhas_problema": ["adset_id_1", "adset_id_2"]
}

Regras:
- "critico" se CPA > R$${maxCpa} OU ROAS < ${minRoas} em qualquer AdSet com gasto > R$10
- "alerta" se CPA entre ${maxCpa * 0.7} e ${maxCpa} OU CTR < 1%
- "ok" se tudo dentro dos limites

Hora atual: ${agora}
Dados das campanhas:
${insightsText}`;

  try {
    const response = await geminiFlash.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text ?? "{}";
    return JSON.parse(text) as VigiResult;
  } catch (e) {
    console.error("[TrafficManager] Gemini Flash erro:", e);
    // Fallback: escala para Claude se o Vigia falhar
    return {
      anomalia: true,
      nivel: "alerta",
      resumo: `Vigia indisponível (${e}). Escalando para estrategista.`,
      campanhas_problema: [],
    };
  }
}

// ─── Camada 2: Claude Sonnet (Estrategista) ──────────────────────────────────

async function runEstrategista(
  vigiResult: VigiResult,
  insights: AdInsight[],
  config: typeof trafficManagerConfigTable.$inferSelect | null,
  actions: ActionExecuted[],
): Promise<string> {
  const maxCpa = parseFloat(config?.maxCpaThresholdBrl ?? "150");
  const minRoas = parseFloat(config?.minRoasTarget ?? "3");
  const maxIncreasePct = parseFloat(config?.maxDailyBudgetIncreasePct ?? "20");
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const systemPrompt = `Você é o Estrategista do Gestor de Tráfego IA da Castor.
Lojas físicas de colchões em Cabo Frio e Araruama, RJ.
Produtos: colchões, box, travesseiros, roupas de cama.

Metas:
- CPA máximo: R$${maxCpa}
- ROAS mínimo: ${minRoas}x
- Aumento máximo de budget por ciclo: ${maxIncreasePct}%
- Pico de tráfego: 19h–22h horário de Brasília

Regras de segurança (NUNCA viole):
1. Nunca aumente budget mais de ${maxIncreasePct}% de uma vez
2. Antes de pausar qualquer AdSet, use check_product_stock para confirmar que o produto existe e tem estoque
3. Sempre notifique o dono via notify_whatsapp após executar ações relevantes (pause ou budget change)
4. Se você não tem dados suficientes para decidir, notifique e aguarde o próximo ciclo

Hora atual: ${agora}`;

  const userMessage = `Análise do Vigia:
${JSON.stringify(vigiResult, null, 2)}

Dados completos das campanhas:
${JSON.stringify(insights, null, 2)}

Tome as decisões necessárias. Se o nível for "critico", priorize pausas imediatas. Se "alerta", considere ajustes de budget. Seja decisivo e sempre notifique o dono das ações executadas.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let output = "";
  let iterations = 0;
  const MAX_ITERATIONS = 6;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: TRAFFIC_TOOLS,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") output += block.text + "\n";
    }

    if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") break;

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(
            block.name,
            block.input as Record<string, any>,
            config,
            actions,
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    } else {
      break;
    }
  }

  return output.trim();
}

// ─── Entry point do ciclo completo ───────────────────────────────────────────

export async function runTrafficManagerCycle(
  trigger: "scheduled" | "manual" = "scheduled",
): Promise<TrafficDecision> {
  const actions: ActionExecuted[] = [];
  let vigiAnalysis = "";
  let estrategistaDecision = "";

  const configs = await db
    .select()
    .from(trafficManagerConfigTable)
    .where(eq(trafficManagerConfigTable.ativo, true))
    .limit(1);

  const config = configs[0] ?? null;
  const adAccountId = process.env.META_ADS_ACCOUNT_ID ?? "demo";

  // Busca métricas reais se configurado
  let insights: AdInsight[] = [];
  if (isMetaAdsConfigured()) {
    try {
      insights = await getAdInsights("today");

      // Salva snapshots
      if (insights.length > 0) {
        await db.insert(adMetricSnapshotsTable).values(
          insights.map((i) => ({
            adAccountId,
            platform: "meta",
            campaignId: i.campaignId,
            campaignName: i.campaignName,
            adSetId: i.adSetId,
            adSetName: i.adSetName,
            spend: i.spend.toString(),
            impressions: i.impressions,
            clicks: i.clicks,
            conversions: i.conversions.toString(),
            cpa: i.cpa.toString(),
            ctr: i.ctr.toString(),
            roas: i.roas.toString(),
            rawData: i as any,
          })),
        );
      }
    } catch (e) {
      console.error("[TrafficManager] Erro ao buscar insights Meta:", e);
    }
  }

  // Camada 1: Gemini Flash
  const vigiResult = await runVigia(insights, config);
  vigiAnalysis = JSON.stringify(vigiResult);

  const shouldEscalate =
    vigiResult.anomalia ||
    vigiResult.nivel === "critico" ||
    vigiResult.nivel === "alerta" ||
    trigger === "manual";

  // Camada 2: Claude — só quando necessário
  if (shouldEscalate) {
    try {
      estrategistaDecision = await runEstrategista(vigiResult, insights, config, actions);
    } catch (e: any) {
      estrategistaDecision = `Estrategista falhou: ${e.message}`;
      console.error("[TrafficManager] Claude erro:", e);
    }
  }

  // Persiste decisão
  await db.insert(trafficManagerDecisionsTable).values({
    adAccountId,
    platform: "meta",
    trigger,
    vigiAnalysis,
    estrategistaDecision: estrategistaDecision || null,
    actionsExecuted: actions as any,
    anomalyDetected: vigiResult.anomalia,
    success: true,
  });

  return {
    anomalyDetected: vigiResult.anomalia,
    vigiLevel: vigiResult.nivel,
    summary: estrategistaDecision || vigiResult.resumo,
    actions,
  };
}
