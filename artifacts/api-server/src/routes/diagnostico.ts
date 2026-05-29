import { Router, type IRouter, type Request, type Response } from "express";
import { processarDiagnostico, selecionarProduto, gerarSaida } from "../lib/motor";
import { db } from "@workspace/db";
import { diagnosticosTable } from "@workspace/db/schema";
import { resolveOrCreateCustomerByPhone } from "../services/memory/identity";

const router: IRouter = Router();

router.post("/diagnostico", async (req: Request, res: Response) => {
  const data      = req.body;
  const analise   = processarDiagnostico(data);
  const produto   = selecionarProduto(data, analise);
  const resultado = gerarSaida(data, analise, produto);

  // Resolve customer identity and persist — non-blocking
  (async () => {
    try {
      let customerId: number | null = null;
      if (data.whatsapp) {
        customerId = await resolveOrCreateCustomerByPhone(
          data.whatsapp,
          data.nome ?? null,
          data.lojaId ?? 1,
        );
      }

      await db.insert(diagnosticosTable).values({
        lojaId:               data.lojaId ?? 1,
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
      });
    } catch (err) {
      console.error("[diagnostico] persist error:", err);
    }
  })();

  res.json(resultado);
});

export default router;
