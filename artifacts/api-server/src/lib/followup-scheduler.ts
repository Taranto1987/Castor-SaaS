import { db } from "@workspace/db";
import { orcamentosTable, followUpsTable } from "@workspace/db/schema";
import { eq, and, lte } from "drizzle-orm";

function sanitizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto;
}

function gerarMensagemFollowUp(
  tipo: string,
  cliente: string,
  produtos: string,
  totalPix: string | null,
  vendedor: string | null
): string {
  const nome = primeiroNome(cliente);
  const valor = totalPix ? ` de ${totalPix}` : "";
  const remetente = vendedor && vendedor !== "ThallesZzz" ? vendedor : "Equipe Castor";

  switch (tipo) {
    case "dia3":
      return `Oi ${nome}! 👋 Aqui é ${remetente} da Castor Exclusiva.\n\nPassei pra ver se ficou com alguma dúvida sobre o ${produtos}${valor} que te apresentei. Está disponível e posso fechar hoje! 😊`;
    case "dia7":
      return `Oi ${nome}! ${remetente} da Castor aqui. 🛏️\n\nO orçamento do ${produtos}${valor} ainda está em aberto. Estoque é limitado e não quero que você perca essa condição. Podemos finalizar? ✅`;
    case "dia14":
      return `Oi ${nome}, tudo bem? ${remetente} da Castor.\n\nSeu orçamento${valor} está prestes a expirar. Quer garantir o preço especial ainda? Me avisa que finalizo agora! 🙏`;
    default:
      return `Oi ${nome}! ${remetente} da Castor. Passando pra dar um alô sobre seu orçamento${valor}. Podemos ajudar? 😊`;
  }
}

interface JanelaFollowUp {
  tipo: string;
  minDias: number;
  maxDias: number;
}

const JANELAS: JanelaFollowUp[] = [
  { tipo: "dia3",  minDias: 3,  maxDias: 6  },
  { tipo: "dia7",  minDias: 7,  maxDias: 13 },
  { tipo: "dia14", minDias: 14, maxDias: 45 },
];

async function gerarFollowUpsPendentes(): Promise<number> {
  const agora = new Date();
  let gerados = 0;

  for (const janela of JANELAS) {
    // limite superior: orçamentos criados há pelo menos minDias dias
    const corte = new Date(agora);
    corte.setDate(corte.getDate() - janela.minDias);

    const orcamentos = await db
      .select()
      .from(orcamentosTable)
      .where(
        and(
          eq(orcamentosTable.status, "pendente"),
          lte(orcamentosTable.criadoEm, corte)
        )
      );

    for (const orc of orcamentos) {
      if (!orc.criadoEm) continue;

      const diasDesde = Math.floor(
        (agora.getTime() - new Date(orc.criadoEm).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Só processa na janela correta
      if (diasDesde < janela.minDias || diasDesde > janela.maxDias) continue;

      // Garante idempotência: não cria duplicata para o mesmo tipo
      const existente = await db
        .select({ id: followUpsTable.id })
        .from(followUpsTable)
        .where(
          and(
            eq(followUpsTable.orcamentoId, orc.id),
            eq(followUpsTable.tipo, janela.tipo)
          )
        )
        .limit(1);

      if (existente.length > 0) continue;

      interface ProdutoItem { nome?: string }
      const prodItems = (Array.isArray(orc.produtosJson)
        ? orc.produtosJson as ProdutoItem[]
        : []);
      const produtos =
        prodItems.map((p) => p.nome).filter(Boolean).join(", ") || "o produto";

      const mensagem = gerarMensagemFollowUp(
        janela.tipo,
        orc.cliente,
        produtos,
        orc.totalPix,
        orc.vendedor
      );

      const tel = sanitizarTelefone(orc.whatsapp);
      const waLink = tel
        ? `https://wa.me/${tel}?text=${encodeURIComponent(mensagem)}`
        : null;

      await db.insert(followUpsTable).values({
        orcamentoId: orc.id,
        tipo: janela.tipo,
        mensagem,
        waLink,
      });

      gerados++;
    }
  }

  return gerados;
}

export function iniciarSchedulerFollowUps() {
  // Executa imediatamente no startup
  gerarFollowUpsPendentes()
    .then((g) => {
      if (g > 0)
        console.log(`[FollowUp] ${g} follow-up(s) gerado(s) automaticamente`);
    })
    .catch((err) =>
      console.error("[FollowUp] Erro ao gerar follow-ups:", err)
    );

  // Verifica a cada 6 horas
  const MS_6H = 6 * 60 * 60 * 1000;
  setInterval(() => {
    gerarFollowUpsPendentes()
      .then((g) => {
        if (g > 0) console.log(`[FollowUp] ${g} follow-up(s) gerado(s)`);
      })
      .catch((err) => console.error("[FollowUp] Erro:", err));
  }, MS_6H);
}
