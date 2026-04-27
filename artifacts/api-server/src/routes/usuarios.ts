import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { colaboradoresTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSession, isDono } from "../lib/sessions";
import { str } from "../utils/params.js";

const router: IRouter = Router();

function requireDono(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Sessão não encontrada" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  if (!isDono(session)) { res.status(403).json({ error: "Acesso restrito ao dono" }); return; }
  next();
}

function mapUser(u: typeof colaboradoresTable.$inferSelect) {
  return {
    id: u.id,
    codigo: u.codigo,
    nome: u.nome,
    papel: u.papel,
    operacao: u.operacao,
    wa: u.wa,
    waRaw: u.waRaw,
    tom: u.tom,
    header: u.header,
    assinatura: u.assinatura,
    ativo: u.ativo,
    ultimoAcesso: u.ultimoAcesso?.toISOString() ?? null,
    criadoEm: u.criadoEm?.toISOString() ?? null,
  };
}

// GET /api/usuarios — lista todos (requireDono)
router.get("/", requireDono, async (_req, res) => {
  try {
    const users = await db
      .select()
      .from(colaboradoresTable)
      .orderBy(colaboradoresTable.criadoEm);
    res.json(users.map(mapUser));
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/usuarios — criar usuário (requireDono)
router.post("/", requireDono, async (req, res) => {
  try {
    const { codigo, nome, papel, operacao, wa, waRaw, tom, header, assinatura } = req.body;

    if (!codigo || !nome || !papel || !operacao) {
      res.status(400).json({ error: "codigo, nome, papel e operacao são obrigatórios" });
      return;
    }

    const codigoNorm = String(codigo).trim().toUpperCase();

    // Verifica duplicata
    const [existing] = await db
      .select({ id: colaboradoresTable.id })
      .from(colaboradoresTable)
      .where(eq(colaboradoresTable.codigo, codigoNorm))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Código de acesso já em uso" });
      return;
    }

    const papeis = ["dono", "vendedor", "entrega", "financeiro"];
    if (!papeis.includes(papel)) {
      res.status(400).json({ error: "Papel inválido" });
      return;
    }

    // Auto-gera header e assinatura se não fornecidos
    const cidade = operacao === "araruama" ? "ARARUAMA" : "CABO FRIO";
    const cidadeDisplay = operacao === "araruama" ? "Araruama" : "Cabo Frio";
    const headerFinal = header || `🏪 CASTOR ${cidade} | ${nome}`;
    const assinaturaFinal = assinatura || `${nome} — Castor ${cidadeDisplay}`;
    const tomFinal = tom || "direto";

    // Normaliza waRaw: se não fornecido, extrai dígitos de wa
    let waRawFinal = waRaw ?? null;
    if (!waRawFinal && wa) {
      waRawFinal = "55" + wa.replace(/\D/g, "");
    }

    const [inserted] = await db
      .insert(colaboradoresTable)
      .values({
        codigo: codigoNorm,
        nome,
        papel,
        operacao,
        wa: wa ?? null,
        waRaw: waRawFinal,
        tom: tomFinal,
        header: headerFinal,
        assinatura: assinaturaFinal,
        ativo: true,
      })
      .returning();

    res.json(mapUser(inserted));
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /api/usuarios/:id/senha — troca código de acesso (requireDono)
router.patch("/:id/senha", requireDono, async (req, res) => {
  try {
    const id = parseInt(str(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { novoCodigo } = req.body;
    if (!novoCodigo || typeof novoCodigo !== "string" || novoCodigo.trim().length < 3) {
      res.status(400).json({ error: "novoCodigo obrigatório (mínimo 3 caracteres)" });
      return;
    }

    const codigoNorm = novoCodigo.trim().toUpperCase();

    // Verifica duplicata (em outro usuário)
    const [dup] = await db
      .select({ id: colaboradoresTable.id })
      .from(colaboradoresTable)
      .where(eq(colaboradoresTable.codigo, codigoNorm))
      .limit(1);

    if (dup && dup.id !== id) {
      res.status(409).json({ error: "Código já em uso por outro usuário" });
      return;
    }

    const [updated] = await db
      .update(colaboradoresTable)
      .set({ codigo: codigoNorm })
      .where(eq(colaboradoresTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    res.json(mapUser(updated));
  } catch (error) {
    console.error("Erro ao trocar senha:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /api/usuarios/:id/ativo — ativa/desativa (requireDono)
router.patch("/:id/ativo", requireDono, async (req, res) => {
  try {
    const id = parseInt(str(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { ativo } = req.body;
    if (typeof ativo !== "boolean") {
      res.status(400).json({ error: "Campo ativo (boolean) obrigatório" });
      return;
    }

    const [updated] = await db
      .update(colaboradoresTable)
      .set({ ativo })
      .where(eq(colaboradoresTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    res.json(mapUser(updated));
  } catch (error) {
    console.error("Erro ao atualizar ativo:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
