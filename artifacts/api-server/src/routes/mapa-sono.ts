import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { produtosTable } from "@workspace/db/schema";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import {
  validarPerfil,
  montarRanking,
  type PerfilDiagnostico,
  type ProdutoCatalogoInput,
} from "../lib/motor-v2";

const router: IRouter = Router();

// POST /api/mapa-sono/compatibilidade — público (alimenta a Fase B do Mapa do Sono)
// Contrato: { success, data, error? }. lojaId obrigatório — sem fallback para loja 1.
router.post("/mapa-sono/compatibilidade", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const lojaIdRaw = body.lojaId;
    const lojaId = typeof lojaIdRaw === "number" ? lojaIdRaw : Number(lojaIdRaw);
    if (lojaIdRaw === undefined || lojaIdRaw === null || !Number.isInteger(lojaId) || lojaId <= 0) {
      res.status(400).json({ success: false, error: "lojaId é obrigatório" });
      return;
    }

    const erro = validarPerfil(body);
    if (erro) {
      res.status(400).json({ success: false, error: erro });
      return;
    }

    const perfil: PerfilDiagnostico = {
      incomodo: body.incomodo as PerfilDiagnostico["incomodo"],
      ocupacao: body.ocupacao as PerfilDiagnostico["ocupacao"],
      pesoA: body.pesoA as number,
      pesoB: typeof body.pesoB === "number" ? body.pesoB : undefined,
      posicao: body.posicao as PerfilDiagnostico["posicao"],
      dores: body.dores as PerfilDiagnostico["dores"],
      calor: body.calor as boolean,
      lojaId,
    };

    // Produtos elegíveis: SEMPRE do banco, por loja_id (mesmos filtros do catálogo público)
    const rows = await db
      .select({
        id: produtosTable.id,
        nome: produtosTable.nome,
        familyName: produtosTable.familyName,
        familySlug: produtosTable.familySlug,
        size: produtosTable.size,
        precoPix: produtosTable.precoPix,
        custoBRL: produtosTable.custoBRL,
        imagem: produtosTable.imagem,
      })
      .from(produtosTable)
      .where(and(
        eq(produtosTable.lojaId, lojaId),
        eq(produtosTable.categoria, "colchoes"),
        eq(produtosTable.disponivel, true),
        eq(produtosTable.encomenda, false),
        or(isNull(produtosTable.estoque), gt(produtosTable.estoque, 0)),
      ))
      .limit(500);

    const produtos: ProdutoCatalogoInput[] = rows;
    const data = montarRanking(perfil, produtos);

    // ranking vazio é resposta válida — o frontend mostra "fale com especialista"
    res.json({ success: true, data });
  } catch (err) {
    console.error("[MapaSono] POST /compatibilidade error:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

export default router;
