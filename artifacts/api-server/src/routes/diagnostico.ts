import { Router, type IRouter, type Request, type Response } from "express";
import { processarDiagnostico, selecionarProduto, gerarSaida } from "../lib/motor";

const router: IRouter = Router();

router.post("/diagnostico", (req: Request, res: Response) => {
  const data = req.body;
  const analise = processarDiagnostico(data);
  const produto = selecionarProduto(data, analise);
  const resultado = gerarSaida(data, analise, produto);
  res.json(resultado);
});

export default router;
