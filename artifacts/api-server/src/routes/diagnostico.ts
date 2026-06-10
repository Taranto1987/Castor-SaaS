import { Router, type IRouter, type Request, type Response } from "express";
import { processarDiagnostico, selecionarProduto, gerarSaida } from "../lib/motor";
import { db } from "@workspace/db";
import { diagnosticosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
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

      const [inserted] = await db.insert(diagnosticosTable).values({
        lojaId,
        customerId:           customerId ?? undefined,
        nome:                 data.nome ?? null,
        whatsapp:             data.whatsapp ?? null,
        produto_recomendado:  resultado.produto,
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
      }).returning({ id: diagnosticosTable.id });

      // Create (or advance) a CRM lead for every Mapa do Sono respondent with a phone number
      if (customerId && inserted?.id) {
        const leadId = await ensureLeadForCustomer({
          lojaId,
          customerId,
          nome: data.nome ?? "Visitante",
          whatsapp: data.whatsapp,
          origem: "mapa_sono",
          estagioMinimo: "novo",
        });

        if (leadId) {
          await db.update(diagnosticosTable)
            .set({ leadId })
            .where(eq(diagnosticosTable.id, inserted.id));
        }
      }
    } catch (err) {
      console.error("[diagnostico] persist error:", err);
    }
  })();

  res.json(resultado);
});

export default router;
