import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireDono, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/ai-custos", requireDono, async (req: AuthRequest, res) => {
  const lojaId = req.session!.lojaId;
  const dias = Math.min(Number(req.query.dias) || 30, 90);

  try {
    const [porDia, porContexto, porModelo, totalGeral] = await Promise.all([
      db.execute(sql`
        SELECT
          criado_em::date AS dia,
          COUNT(*)::int AS requests,
          SUM(input_tokens)::int AS input_tokens,
          SUM(output_tokens)::int AS output_tokens,
          SUM(custo_estimado)::float AS custo_usd
        FROM ai_usage
        WHERE loja_id = ${lojaId}
          AND criado_em > NOW() - MAKE_INTERVAL(days => ${dias})
        GROUP BY criado_em::date
        ORDER BY dia DESC
      `),

      db.execute(sql`
        SELECT
          contexto,
          COUNT(*)::int AS requests,
          SUM(input_tokens)::int AS input_tokens,
          SUM(output_tokens)::int AS output_tokens,
          SUM(custo_estimado)::float AS custo_usd
        FROM ai_usage
        WHERE loja_id = ${lojaId}
          AND criado_em > NOW() - MAKE_INTERVAL(days => ${dias})
        GROUP BY contexto
        ORDER BY custo_usd DESC
      `),

      db.execute(sql`
        SELECT
          modelo,
          COUNT(*)::int AS requests,
          SUM(input_tokens)::int AS input_tokens,
          SUM(output_tokens)::int AS output_tokens,
          SUM(custo_estimado)::float AS custo_usd
        FROM ai_usage
        WHERE loja_id = ${lojaId}
          AND criado_em > NOW() - MAKE_INTERVAL(days => ${dias})
        GROUP BY modelo
        ORDER BY custo_usd DESC
      `),

      db.execute(sql`
        SELECT
          COUNT(*)::int AS total_requests,
          SUM(input_tokens)::int AS total_input,
          SUM(output_tokens)::int AS total_output,
          SUM(custo_estimado)::float AS custo_total_usd,
          MIN(criado_em) AS primeiro_registro,
          MAX(criado_em) AS ultimo_registro
        FROM ai_usage
        WHERE loja_id = ${lojaId}
          AND criado_em > NOW() - MAKE_INTERVAL(days => ${dias})
      `),
    ]);

    res.json({
      periodo_dias: dias,
      resumo: (totalGeral as any).rows[0] ?? null,
      por_dia: (porDia as any).rows,
      por_contexto: (porContexto as any).rows,
      por_modelo: (porModelo as any).rows,
    });
  } catch (err) {
    console.error("[ai-custos] Query failed:", err);
    res.status(500).json({ error: "Erro ao consultar custos de IA" });
  }
});

export default router;
