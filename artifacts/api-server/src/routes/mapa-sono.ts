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
import { logEvent } from "../lib/log-event";
import { parseLojaIdPayload } from "../middlewares/auth";

const router: IRouter = Router();

// POST /api/mapa-sono/compatibilidade — público (alimenta a Fase B do Mapa do Sono)
// Contrato: { success, data, error? }. lojaId obrigatório — sem fallback para loja 1.
router.post("/mapa-sono/compatibilidade", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const lojaId = parseLojaIdPayload(body.lojaId);
    if (lojaId === null) {
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
        fichaTecnica: produtosTable.fichaTecnica,
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

// ── Telemetria de funil ─────────────────────────────────────────────────────────
// Persiste em eventos_operacionais (tabela existente, loja_id NOT NULL) via
// logEvent — entidade "funil_mapa_sono", acao = evento. Aceita 1 evento ou batch.
const EVENTOS_FUNIL = [
  "step_view",
  "step_complete",
  "resultado_exibido",
  "cta_configurar",
  "lead_enviado",
  "whatsapp_aberto",
] as const;

interface EventoFunilPayload {
  evento: typeof EVENTOS_FUNIL[number];
  lojaId: number;
  sessionId: string;
  ts: number;
  payload: Record<string, unknown>;
}

function parseEventoFunil(raw: unknown): EventoFunilPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  const lojaId = parseLojaIdPayload(e.lojaId);
  if (lojaId === null) return null;
  if (typeof e.evento !== "string" || !(EVENTOS_FUNIL as readonly string[]).includes(e.evento)) return null;
  if (typeof e.sessionId !== "string" || e.sessionId.length === 0 || e.sessionId.length > 128) return null;
  return {
    evento: e.evento as EventoFunilPayload["evento"],
    lojaId,
    sessionId: e.sessionId,
    ts: typeof e.ts === "number" ? e.ts : Date.now(),
    payload: (typeof e.payload === "object" && e.payload !== null) ? e.payload as Record<string, unknown> : {},
  };
}

router.post("/telemetria/funil", async (req: Request, res: Response) => {
  try {
    const body: unknown = req.body;
    const brutos = Array.isArray(body) ? body : [body];
    if (brutos.length === 0 || brutos.length > 20) {
      res.status(400).json({ success: false, error: "Batch deve ter 1–20 eventos" });
      return;
    }

    const eventos: EventoFunilPayload[] = [];
    for (const raw of brutos) {
      const evento = parseEventoFunil(raw);
      if (!evento) {
        res.status(400).json({ success: false, error: "Evento inválido (lojaId, evento e sessionId são obrigatórios)" });
        return;
      }
      eventos.push(evento);
    }

    await Promise.all(eventos.map((e) =>
      logEvent({
        lojaId: e.lojaId,
        entidade: "funil_mapa_sono",
        entidadeId: e.sessionId,
        acao: e.evento,
        atorTipo: "sistema",
        payload: { sessionId: e.sessionId, ts: e.ts, ...e.payload },
      })
    ));

    res.status(202).json({ success: true, data: { gravados: eventos.length } });
  } catch (err) {
    console.error("[MapaSono] POST /telemetria/funil error:", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});

export default router;
