import { Router, type IRouter, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { autoSalvarOrcamentoDaConversa } from "../lib/orcamento-utils";

const router: IRouter = Router();

const SYSTEM_PROMPT = `Você é o ThallesZzz, consultor especialista em colchões da Castor Exclusiva — loja autorizada da fábrica Castor na Região dos Lagos, RJ (Cabo Frio e Araruama).

## Sua Personalidade
- Profissional, técnico e consultivo — como um especialista em sono
- Usa linguagem clara e acessível, mas demonstra autoridade técnica
- Simpático e acolhedor, sem ser informal demais
- Foco em resolver o problema do cliente (sono ruim, dor nas costas, etc.)

## Seu Conhecimento Técnico
Você domina profundamente as tecnologias Castor:
- **Molas Ensacadas (Pocket)**: molas individuais em sacos de tecido, absorção de impacto independente, ideal para casais
- **Molas Bonnel**: sistema interligado, boa sustentação, custo-benefício
- **Espuma D33/D45/D65**: densidades para diferentes pesos e necessidades
- **Látex**: material viscoelástico, adaptação ao corpo, alívio de pressão
- **Viscoelástico (Memory Foam)**: espuma com memória, se molda ao corpo
- **Pillow Top**: camada extra de conforto no topo do colchão
- **Euro Top**: similar ao pillow, mas costurado rente à borda
- **Sistema de ventilação**: canais de ar para controle térmico
- **Tratamento antiácaro**: proteção hipoalergênica
- **Tecido Bambu**: tecido com fibra de bambu, toque fresco e macio

## Técnicas de Venda Consultiva
Você aplica naturalmente:
1. **Perguntas investigativas**: descubra o problema real (dor, calor, parceiro se mexe, etc.)
2. **Escuta ativa**: repita o problema do cliente para mostrar que entendeu
3. **Autoridade técnica**: explique POR QUE determinada tecnologia resolve o problema
4. **Prova social**: "A maioria dos nossos clientes com esse perfil escolhe..."
5. **Escassez sutil**: "Esse modelo costuma esgotar rápido" (só quando verdade)
6. **Reciprocidade**: ofereça valor antes de pedir algo (dicas de sono, informação técnica)
7. **Compromisso progressivo**: comece com perguntas simples antes de recomendar
8. **Ancoragem**: apresente opções de diferentes faixas, começando pela premium
9. **Custo por noite**: "Esse colchão sai a menos de R$1 por noite nos próximos 10 anos"
10. **Urgência genuína**: "Um colchão ruim prejudica sua saúde todos os dias que você adia"

## Fluxo Obrigatório de Captura de Lead
Quando o cliente demonstrar interesse real em comprar (pergunta sobre preço, prazo, tamanho, condição):
1. Faça no máximo 2-3 perguntas diagnósticas para entender o perfil
2. Recomende o produto ideal com justificativa técnica (use o ID do produto do catálogo)
3. **SEMPRE pergunte**: "Para preparar seu orçamento personalizado e te enviar todas as condições, pode me passar seu **nome** e **WhatsApp**?"
4. Quando receber nome + WhatsApp, confirme: "Perfeito, [Nome]! Orçamento em preparação. Mas já posso te adiantar: [produto] por PIX [preço], ou 12x de [parcela]. Quer fechar agora?"
5. Finalize sempre direcionando: "Quer que a gente continue pelo WhatsApp para fechar em detalhes? Posso preparar uma condição especial."

## Regras Importantes
- NUNCA invente preços. Use APENAS os preços do catálogo fornecido (campo PIX e Prazo).
- Se não souber o preço, diga "deixa eu verificar com a equipe" e sugira falar no WhatsApp.
- Sempre tente entender o PROBLEMA antes de recomendar um produto.
- Faça no máximo 2-3 perguntas antes de dar uma primeira recomendação.
- Quando recomendar um produto, explique tecnicamente por que ele resolve o problema.
- Use formatação com negrito (**texto**) para destacar pontos importantes.
- Respostas curtas e diretas — máximo 3-4 parágrafos por mensagem.
- Responda APENAS em português brasileiro.
- Você atende Cabo Frio (Thalles, (22) 99241-0112) e Araruama (Marcela, (22) 98844-7240).
- Se o cliente perguntar sobre entrega: entregamos em toda a Região dos Lagos sem custo adicional.

## Sobre a Loja
- Castor Exclusiva Cabo Frio — Av. Júlia Kubitschek, 64, Jardim Flamboyant, Cabo Frio
- Castor Exclusiva Araruama — Av. Getúlio Vargas, 137, Centro, Araruama
- Autorizada de fábrica: preços diretos, garantia total
- Entrega grátis em Cabo Frio, Búzios, Arraial do Cabo, São Pedro da Aldeia, Araruama, Iguaba Grande, Saquarema
- Pagamento: PIX (melhor preço), cartão até 12x, boleto
- Garantia de fábrica Castor

## Catálogo de Produtos (dados reais)
Os produtos serão fornecidos como contexto com ID, nome e preço. Use esses IDs ao recomendar.
`;

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new Anthropic({ baseURL: "https://api.anthropic.com", apiKey });
}

function sendSSEMessage(res: Response, payload: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildFallbackMessage(lastUserMessage: string): string {
  const hasContext = lastUserMessage.trim().length > 0;

  return `${hasContext ? "Entendi seu caso. " : ""}Pra te indicar com precisão, me responde rapidinho:\n\n1) Você dorme de lado, costas ou bruços?\n2) Qual sua faixa de peso?\n3) Prefere colchão mais firme ou mais macio?\n\nCom isso eu já te passo uma recomendação inicial sem inventar preço. Se quiser, também posso te encaminhar direto pro WhatsApp da loja pra fechar com condição especial.`;
}

async function getProductContext(): Promise<string> {
  try {
    const allProducts = await db
      .select({
        nome: produtosTable.nome,
        categoria: produtosTable.categoria,
        precoPix: produtosTable.precoPix,
        preco: produtosTable.preco,
        parcelamento: produtosTable.parcelamento,
        medidas: produtosTable.medidas,
        altura: produtosTable.altura,
      })
      .from(produtosTable)
      .where(eq(produtosTable.disponivel, true));

    if (allProducts.length === 0) return "Catálogo vazio no momento.";

    const grouped: Record<string, typeof allProducts> = {};
    for (const p of allProducts) {
      const cat = p.categoria || "outros";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    try {
          const allProducts = await db
            .select({
                      id: produtosTable.id,
                      nome: produtosTable.nome,
                      categoria: produtosTable.categoria,
                      precoPix: produtosTable.precoPix,
                      preco: produtosTable.preco,
                      parcelamento: produtosTable.parcelamento,
                      medidas: produtosTable.medidas,
                      altura: produtosTable.altura,
            })
            .from(produtosTable)
            .where(eq(produtosTable.disponivel, true));

      if (allProducts.length === 0) return "Catálogo vazio no momento.";

      const grouped: Record<string, typeof allProducts> = {};
          for (const p of allProducts) {
                  const cat = p.categoria || "outros";
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(p);
          }

      let ctx = "## Produtos Disponíveis (use o ID ao recomendar)\n\n";
          for (const [cat, items] of Object.entries(grouped)) {
                  ctx += `### ${cat}\n`;
                  for (const p of items.slice(0, 15)) {
                            ctx += `- [ID:${p.id}] **${p.nome}**`;
                            if (p.medidas) ctx += ` (${p.medidas})`;
                            if (p.precoPix) ctx += ` — PIX: ${p.precoPix}`;
                            if (p.preco) ctx += ` | Prazo: ${p.preco}`;
                            if (p.parcelamento) ctx += ` (${p.parcelamento})`;
                            ctx += "\n";
                  }
                  if (items.length > 15) ctx += ` ... e mais ${items.length - 15} produtos\n`;
                  ctx += "\n";
          }
          return ctx;
    } catch {
          return "Catálogo temporariamente indisponível.";
    }

    let ctx = "## Produtos Disponíveis\n\n";
    for (const [cat, items] of Object.entries(grouped)) {
      ctx += `### ${cat}\n`;
      for (const p of items.slice(0, 15)) {
        ctx += `- **${p.nome}**`;
        if (p.medidas) ctx += ` (${p.medidas})`;
        if (p.precoPix) ctx += ` — PIX: ${p.precoPix}`;
        if (p.preco) ctx += ` | Prazo: ${p.preco}`;
        if (p.parcelamento) ctx += ` (${p.parcelamento})`;
        ctx += "\n";
      }
      if (items.length > 15) ctx += ` ... e mais ${items.length - 15} produtos\n`;
      ctx += "\n";
    }
    return ctx;
  } catch {
    return "Catálogo temporariamente indisponível.";
  }
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExtracaoLead {
  nomeCliente: string | null;
  telefone: string | null;
  produtoIds: number[];
  deveSalvar: boolean;
}

/**
 * Extrai dados estruturados da conversa usando Claude Haiku.
 * Chamado de forma assíncrona após o stream — não afeta latência do chat.
 */
async function extrairDadosConversa(
  messages: ChatMessage[],
  ultimaRespostaAssistente: string
): Promise<ExtracaoLead | null> {
  if (messages.length < 3) return null;

  const conversa = messages
    .map((m) => `${m.role === "user" ? "Cliente" : "ThallesZzz"}: ${m.content}`)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Analise esta conversa de vendas de colchões e extraia dados se presentes.
Retorne APENAS JSON válido, sem markdown, sem explicação.

Conversa:
${conversa}

Última fala do consultor:
${ultimaRespostaAssistente.slice(0, 600)}

JSON esperado:
{
  "nomeCliente": "primeiro nome ou nome completo do cliente, null se não informado",
  "telefone": "apenas dígitos do número brasileiro (ex: 22999990000), null se não informado",
  "produtoIds": [IDs numéricos exatos dos produtos recomendados na conversa, array vazio se nenhum],
  "deveSalvar": true se e somente se temos nomeCliente não-nulo E telefone não-nulo E produtoIds não-vazio
}`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : null;
    if (!text) return null;

    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(clean) as ExtracaoLead;

    if (typeof data !== "object" || data === null) return null;
    if (!Array.isArray(data.produtoIds)) data.produtoIds = [];

    return data;
  } catch {
    return null;
  }
}

/**
 * Pipeline assíncrono pós-stream: extrai lead e auto-salva orçamento.
 * Não bloqueia a resposta SSE — erros são silenciosos.
 */
async function processarLeadDaConversa(
  messages: ChatMessage[],
  ultimaRespostaAssistente: string
): Promise<void> {
  const dados = await extrairDadosConversa(messages, ultimaRespostaAssistente);
  if (!dados?.deveSalvar) return;
  if (!dados.nomeCliente || !dados.telefone || !dados.produtoIds.length) return;

  await autoSalvarOrcamentoDaConversa(
    dados.nomeCliente,
    dados.telefone,
    dados.produtoIds
  );
}

router.post("/", async (req, res) => {
  try {
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const chatMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const lastUserMessage = [...chatMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const client = getAnthropicClient();

    if (!client) {
      sendSSEMessage(res, { content: buildFallbackMessage(lastUserMessage) });
      sendSSEMessage(res, { done: true });
      res.end();
      return;
    }

    const productContext = await getProductContext();

    const stream = client.messages.stream({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: productContext,
        },
      ],
      messages: chatMessages,
    });

    stream.on("text", (text) => {
      sendSSEMessage(res, { content: text });
    });

    await stream.finalMessage();
    sendSSEMessage(res, { done: true });
    res.end();
  } catch (error) {
    console.error("Chat error:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: "Erro interno do chat" });
      return;
      const productContext = await getProductContext();

      const chatMessages = messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content }));

      res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

      let fullAssistantText = "";

      const stream = client.messages.stream({
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              system: [
                {
                            type: "text",
                            text: SYSTEM_PROMPT,
                            cache_control: { type: "ephemeral" },
                },
                {
                            type: "text",
                            text: productContext,
                },
                      ],
              messages: chatMessages,
      });

      stream.on("text", (text) => {
              fullAssistantText += text;
              res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      });

      await stream.finalMessage();
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();

      // Extração e auto-save acontecem após fechar a resposta — sem latência para o usuário
      setImmediate(() => {
        processarLeadDaConversa(chatMessages, fullAssistantText).catch((err) =>
          console.error("[Chat] Erro no processamento de lead:", err)
        );
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

    const rawMessages = (req.body as { messages?: ChatMessage[] })?.messages;
    const lastUserMessage = Array.isArray(rawMessages)
      ? [...rawMessages].reverse().find((m) => m?.role === "user")?.content ?? ""
      : "";

    sendSSEMessage(res, { content: buildFallbackMessage(lastUserMessage) });
    sendSSEMessage(res, { done: true });
    res.end();
  }
});

export default router;
