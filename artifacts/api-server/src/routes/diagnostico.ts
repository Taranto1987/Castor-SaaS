import { Router, type IRouter, type Request, type Response } from "express";
import { processarDiagnostico, selecionarProduto, gerarSaida } from "../lib/motor";
import { db } from "@workspace/db";
import { diagnosticosTable } from "@workspace/db/schema";

const router: IRouter = Router();

router.post("/diagnostico", (req: Request, res: Response) => {
  const data      = req.body;
  const analise   = processarDiagnostico(data);
  const produto   = selecionarProduto(data, analise);
  const resultado = gerarSaida(data, analise, produto);

  // Persist diagnosis — fire-and-forget, never blocks the response
  db.insert(diagnosticosTable).values({
    lojaId:              data.lojaId ?? 1,
    nome:                data.nome ?? null,
    whatsapp:            data.whatsapp ?? null,
    produto_recomendado: resultado.produto,
    confianca:           String(resultado.confianca),
    flag_calibracao:     resultado.flag_calibracao ?? null,
    respostas:           data,
    perfil_biomecanico:  {
      suporte:          analise.suporte,
      firmeza_final:    analise.firmeza_final,
      tecnologia:       analise.tecnologia,
      flag_calibracao:  analise.flag_calibracao,
      texto_calibracao: analise.texto_calibracao,
    },
  }).catch((err: unknown) => {
    console.error("[diagnostico] persist error:", err);
  });

  res.json(resultado);
});

export default router;
