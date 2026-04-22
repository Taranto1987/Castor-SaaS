import { Router, type IRouter, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

## Regras Importantes
- NUNCA invente preços. Use APENAS os preços do catálogo fornecido.
- Se não souber o preço, diga "deixa eu verificar com a equipe" e sugira falar no WhatsApp.
- Sempre tente entender o PROBLEMA antes de recomendar um produto.
- Faça no máximo 2-3 perguntas antes de dar uma primeira recomendação.
- Quando recomendar um produto, explique tecnicamente por que ele resolve o problema.
- No final, sempre direcione para o WhatsApp para fechar: "Quer que eu te passe pro nosso WhatsApp pra gente finalizar? Posso preparar uma condição especial."
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
Os produtos serão fornecidos como contexto. Use esses dados para recomendar.
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
  const topic = lastUserMessage.trim();
  const topicLine = topic
    ? `Entendi seu ponto: **${topic.slice(0, 180)}**. `
    : "";

  return `${topicLine}Pra te indicar com precisão, me responde rapidinho:\n\n1) Você dorme de lado, costas ou bruços?\n2) Qual sua faixa de peso?\n3) Prefere colchão mais firme ou mais macio?\n\nCom isso eu já te passo uma recomendação inicial sem inventar preço. Se quiser, também posso te encaminhar direto pro WhatsApp da loja pra fechar com condição especial.`;
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
