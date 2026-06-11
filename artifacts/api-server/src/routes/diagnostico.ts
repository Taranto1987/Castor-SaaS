import { Router, type IRouter, type Request, type Response } from "express";
import { processarDiagnostico, selecionarProduto, gerarSaida } from "../lib/motor";
import { db } from "@workspace/db";
import { diagnosticosTable, leadInteracoesTable, leadsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveOrCreateCustomerByPhone } from "../services/memory/identity";
import { ensureLeadForCustomer } from "../services/operacoes/repository";

const router: IRouter = Router();

router.post("/diagnostico", async (req: Request, res: Response) => {
  const data      = req.body;
  const analise   = processarDiagnostico(data);
  const produto   = selecionarProduto(data, analise);
  const resultado = gerarSaida(data, analise, produto);

  // Resolve customer identity and persist — non-blocking
  (async () => {
    try {
      const lojaId = data.lojaId ?? 1;
      let customerId: number | null = null;
      if (data.whatsapp) {
        customerId = await resolveOrCreateCustomerByPhone(
          data.whatsapp,
          data.nome ?? null,
          lojaId,
        );
      }

      await db.insert(diagnosticosTable).values({
        lojaId,
        customerId:           customerId ?? undefined,
        nome:                 data.nome ?? null,
        whatsapp:             data.whatsapp ?? null,
        produto_recomendado:  data.produto_recomendado ?? resultado.produto,
        confianca:            String(resultado.confianca),
        flag_calibracao:      resultado.flag_calibracao ?? null,
        respostas:            data,
        perfil_biomecanico:   {
          suporte:          analise.suporte,
          firmeza_final:    analise.firmeza_final,
          tecnologia:       analise.tecnologia,
          flag_calibracao:  analise.flag_calibracao,
          texto_calibracao: analise.texto_calibracao,
        },
        perfil_comportamental: data.perfil_comportamental ?? {},
      });

      // Ensure CRM lead exists and persist biomechanical profile
      const leadId = await ensureLeadForCustomer({
        lojaId,
        customerId,
        nome: data.nome ?? "Visitante",
        whatsapp: data.whatsapp ?? null,
        origem: "mapa_sono",
        estagioMinimo: "contato",
      });

      if (leadId) {
        const dores: string[] = Array.isArray(data.dores) ? data.dores : [];

        // Populate lead's perfilBiomecanico from questionnaire answers + analysis output
        await db
          .update(leadsTable)
          .set({
            perfilBiomecanico: {
              suporte:             analise.suporte,
              firmeza:             analise.firmeza_final,
              tecnologia:          analise.tecnologia,
              altura:              data.altura ?? null,
              peso:                data.peso ?? null,
              posicao:             data.posicao ?? null,
              temperatura:         data.temperatura ?? null,
              dores,
              casal:               data.casal ?? null,
              prioridade:          data.prioridade ?? null,
              tamanho:             data.tamanho ?? null,
              produto_recomendado: data.produto_recomendado ?? resultado.produto,
              compatibilidade:     data.compatibilidade ?? resultado.confianca,
            },
            ultimoContato: new Date(),
            atualizadoEm:  new Date(),
          })
          .where(and(eq(leadsTable.id, leadId), eq(leadsTable.lojaId, lojaId)));

        // Auto-create handoff timeline entry for the vendor
        const compatPct  = Math.round(
          (data.compatibilidade ?? resultado.confianca) <= 1
            ? (data.compatibilidade ?? resultado.confianca) * 100
            : (data.compatibilidade ?? resultado.confianca),
        );
        const doresStr = dores.filter((d: string) => d !== "nenhuma").join(", ") || "nenhuma";
        const tipoUso  =
          data.casal === "casal"    ? "Casal"      :
          data.casal === "hospede"  ? "Hóspede"    : "Individual";

        const linhas = [
          `🌙 Diagnóstico Mapa do Sono concluído`,
          ``,
          `Produto recomendado: ${data.produto_recomendado ?? resultado.produto}`,
          `Compatibilidade biomecânica: ${compatPct}%`,
          ``,
          `Perfil do cliente:`,
          `• Posição ao dormir: ${data.posicao ?? "—"}`,
          `• Perfil térmico: ${data.temperatura === "sim" ? "Sente calor" : "Não sente calor"}`,
          `• Tipo de uso: ${tipoUso}`,
          `• Tamanho desejado: ${data.tamanho ?? "—"}`,
          `• Dores relatadas: ${doresStr}`,
          `• Suporte biomecânico: ${analise.suporte}`,
          `• Tecnologia indicada: ${analise.tecnologia}`,
        ];

        if (analise.flag_calibracao) {
          linhas.push(`• Período de adaptação: ${analise.flag_calibracao.replace(/_/g, " ")}`);
        }

        if (data.altura) linhas.push(`• Altura: ${data.altura} cm`);
        if (data.peso)   linhas.push(`• Peso: ${data.peso} kg`);

        await db.insert(leadInteracoesTable).values({
          leadId,
          lojaId,
          tipo:      "handoff",
          autorNome: "Mapa do Sono IA",
          conteudo:  linhas.join("\n"),
        });
      }
    } catch (err) {
      console.error("[diagnostico] persist error:", err);
    }
  })();

  res.json(resultado);
});

export default router;
