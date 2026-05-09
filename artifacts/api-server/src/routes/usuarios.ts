import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { getSession } from "../lib/sessions";
import { requireAdmin, requireGerente, requireAuth } from "../lib/rbac";
import { CARGOS, type Cargo } from "@workspace/db/schema";
import {
  findUsuariosByLoja,
  findUsuarioById,
  createUsuario,
  updateUsuarioCargo,
  toggleUsuarioAtivo,
  createConvite,
  findConviteValido,
  marcarConviteUsado,
  updateUsuarioSenha,
  createResetToken,
  registrarAudit,
} from "../services/usuarios/repository";
import { destroyAllUserSessions } from "../lib/sessions";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

function clientIp(req: import("express").Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    ""
  );
}

function sessionFromReq(req: import("express").Request) {
  const token = (req.headers["x-session-token"] || "") as string;
  return token ? getSession(token) : null;
}

/** GET /api/usuarios — lista usuários da loja */
router.get("/", requireGerente, async (req, res) => {
  try {
    const session = sessionFromReq(req);
    if (!session) { res.status(401).json({ error: "Sessão inválida" }); return; }
    const lojaId = session.cargo === "ADMIN" ? (session.lojaId ?? 1) : session.lojaId;
    res.json(await findUsuariosByLoja(lojaId));
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/** POST /api/usuarios — cria novo usuário (sem senha; gera convite) */
router.post("/", requireAdmin, async (req, res) => {
  try {
    const session = sessionFromReq(req);
    if (!session) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const { nome, email, cargo, operacao, wa, waRaw, tom, header, assinatura } = req.body;

    if (!nome || !email || !cargo || !operacao) {
      res.status(400).json({ error: "nome, email, cargo e operacao são obrigatórios" });
      return;
    }
    if (!CARGOS.includes(cargo as Cargo)) {
      res.status(400).json({ error: `Cargo inválido. Válidos: ${CARGOS.join(", ")}` });
      return;
    }

    const lojaIdMap: Record<string, number> = { cabo_frio: 1, araruama: 2 };
    const lojaId = lojaIdMap[operacao as string] ?? session.lojaId;

    const cidade = operacao === "araruama" ? "ARARUAMA" : "CABO FRIO";
    const cidadeDisplay = operacao === "araruama" ? "Araruama" : "Cabo Frio";
    const headerFinal = header || `🏪 CASTOR ${cidade} | ${nome}`;
    const assinaturaFinal = assinatura || `${nome} — Castor ${cidadeDisplay}`;
    let waRawFinal: string | null = waRaw ?? null;
    if (!waRawFinal && wa) waRawFinal = "55" + String(wa).replace(/\D/g, "");

    const usuario = await createUsuario({
      nome,
      email: String(email).toLowerCase().trim(),
      cargo: cargo as Cargo,
      lojaId,
      operacao,
      wa: wa ?? null,
      waRaw: waRawFinal,
      tom: tom || "direto",
      header: headerFinal,
      assinatura: assinaturaFinal,
    });

    const convite = await createConvite(usuario.id);

    await registrarAudit({
      lojaId: session.lojaId,
      usuarioId: session.userId > 0 ? session.userId : undefined,
      acao: "CREATE_USER",
      detalhes: { usuarioCriado: usuario.id, email: usuario.email },
      ip: clientIp(req),
    });

    res.status(201).json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cargo: usuario.cargo,
        lojaId: usuario.lojaId,
        ativo: usuario.ativo,
      },
      convite: {
        token: convite.token,
        expiresAt: convite.expiresAt,
        // Link para o admin compartilhar com o funcionário
        link: `/aceitar-convite?token=${convite.token}`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ error: "Email já cadastrado" });
      return;
    }
    res.status(500).json({ error: "Erro interno" });
  }
});

/** PATCH /api/usuarios/:id/cargo — altera cargo */
router.patch("/:id/cargo", requireAdmin, async (req, res) => {
  try {
    const session = sessionFromReq(req);
    if (!session) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const id = parseId(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { cargo } = req.body;
    if (!CARGOS.includes(cargo as Cargo)) {
      res.status(400).json({ error: `Cargo inválido. Válidos: ${CARGOS.join(", ")}` });
      return;
    }

    const row = await updateUsuarioCargo(id, cargo as Cargo);
    if (!row) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    await registrarAudit({
      lojaId: session.lojaId,
      usuarioId: session.userId > 0 ? session.userId : undefined,
      acao: "CHANGE_CARGO",
      detalhes: { alvo: id, novoCargo: cargo },
      ip: clientIp(req),
    });

    res.json(row);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/** PATCH /api/usuarios/:id/ativo — ativa/desativa */
router.patch("/:id/ativo", requireAdmin, async (req, res) => {
  try {
    const session = sessionFromReq(req);
    if (!session) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const id = parseId(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { ativo } = req.body;
    if (typeof ativo !== "boolean") {
      res.status(400).json({ error: "Campo ativo (boolean) obrigatório" });
      return;
    }

    const row = await toggleUsuarioAtivo(id, ativo);
    if (!row) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    if (!ativo) destroyAllUserSessions(id);

    await registrarAudit({
      lojaId: session.lojaId,
      usuarioId: session.userId > 0 ? session.userId : undefined,
      acao: ativo ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      detalhes: { alvo: id },
      ip: clientIp(req),
    });

    res.json(row);
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/** POST /api/usuarios/:id/convite — gera novo convite (admin reenvio) */
router.post("/:id/convite", requireAdmin, async (req, res) => {
  try {
    const session = sessionFromReq(req);
    if (!session) { res.status(401).json({ error: "Sessão inválida" }); return; }

    const id = parseId(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const usuario = await findUsuarioById(id);
    if (!usuario) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    const convite = await createConvite(id);

    res.json({
      token: convite.token,
      expiresAt: convite.expiresAt,
      link: `/aceitar-convite?token=${convite.token}`,
    });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/** POST /api/usuarios/aceitar-convite — funcionário define sua senha pelo token */
router.post("/aceitar-convite", async (req, res) => {
  try {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha || typeof novaSenha !== "string") {
      res.status(400).json({ error: "token e novaSenha são obrigatórios" });
      return;
    }
    if (novaSenha.length < 8) {
      res.status(400).json({ error: "Senha deve ter pelo menos 8 caracteres" });
      return;
    }

    const convite = await findConviteValido(token);
    if (!convite) {
      res.status(400).json({ error: "Convite inválido ou expirado" });
      return;
    }

    const usuario = await findUsuarioById(convite.usuarioId);

    const novoHash = await bcrypt.hash(novaSenha, 10);
    await updateUsuarioSenha(convite.usuarioId, novoHash);
    await marcarConviteUsado(convite.id);

    await registrarAudit({
      lojaId: usuario?.lojaId ?? undefined,
      usuarioId: convite.usuarioId,
      acao: "ACCEPT_INVITE",
      ip: clientIp(req),
    });

    res.json({ ok: true, message: "Senha definida. Faça login com seu email." });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/** POST /api/usuarios/:id/redefinir-senha — admin gera link de reset para funcionário */
router.post("/:id/redefinir-senha", requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const usuario = await findUsuarioById(id);
    if (!usuario) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    const reset = await createResetToken(id);

    res.json({
      token: reset.token,
      expiresAt: reset.expiresAt,
      link: `/redefinir-senha?token=${reset.token}`,
    });
  } catch {
    res.status(500).json({ error: "Erro interno" });
  }
});

/** GET /api/usuarios/cargos — lista cargos disponíveis */
router.get("/cargos", requireAuth, (_req, res) => {
  res.json(CARGOS);
});

export default router;
