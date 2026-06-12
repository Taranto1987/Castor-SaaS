import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import {
  createSession,
  createSessionByEmail,
  getSession,
  destroySession,
  destroyAllUserSessions,
} from "../lib/sessions";
import { requireAuth } from "../lib/rbac";
import {
  findUsuarioById,
  findUsuarioByEmail,
  updateUsuarioSenha,
  createResetToken,
  findResetTokenValido,
  marcarResetTokenUsado,
  registrarAudit,
} from "../services/usuarios/repository";
import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getFeatureFlags } from "../lib/feature-flags";

// Cache de configJson por lojaId — evita query no DB a cada /auth/me
const lojaConfigCache = new Map<number, { config: unknown; expiresAt: number }>();
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getLojaConfig(lojaId: number): Promise<unknown> {
  const cached = lojaConfigCache.get(lojaId);
  if (cached && cached.expiresAt > Date.now()) return cached.config;
  try {
    const [loja] = await db.select({ configJson: lojasTable.configJson }).from(lojasTable).where(eq(lojasTable.id, lojaId)).limit(1);
    const config = loja?.configJson ?? null;
    lojaConfigCache.set(lojaId, { config, expiresAt: Date.now() + CONFIG_CACHE_TTL });
    return config;
  } catch {
    return null;
  }
}

const router: IRouter = Router();

function clientIp(req: import("express").Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    ""
  );
}

/**
 * POST /auth/login
 * Aceita: { email, senha } (novo) ou { code } (legado compatível)
 */
router.post("/login", async (req, res) => {
  const { email, senha, code } = req.body;
  const ip = clientIp(req);

  // Novo fluxo: email + senha
  if (email && senha) {
    if (typeof email !== "string" || typeof senha !== "string") {
      res.status(400).json({ error: "Email e senha são obrigatórios" });
      return;
    }
    const session = await createSessionByEmail(email, senha, ip);
    if (!session) {
      res.status(401).json({ error: "Email ou senha inválidos" });
      return;
    }
    res.json({
      token: session.token,
      userId: session.userId,
      nome: session.nome,
      cargo: session.cargo,
      papel: session.papel,
      operacao: session.operacao,
      lojaId: session.lojaId,
      wa: session.wa,
      waRaw: session.waRaw,
      tom: session.tom,
      header: session.header,
      assinatura: session.assinatura,
    });
    return;
  }

  // Legado: código de acesso
  if (code && typeof code === "string") {
    const session = await createSession(code);
    if (!session) {
      res.status(401).json({ error: "Código inválido" });
      return;
    }
    res.json({
      token: session.token,
      nome: session.nome,
      papel: session.papel,
      cargo: session.cargo,
      operacao: session.operacao,
      lojaId: session.lojaId,
      wa: session.wa,
      waRaw: session.waRaw,
      tom: session.tom,
      header: session.header,
      assinatura: session.assinatura,
    });
    return;
  }

  res.status(400).json({ error: "Forneça email+senha ou code" });
});

router.get("/me", async (req, res) => {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) { res.status(401).json({ error: "Token ausente" }); return; }
  const session = getSession(token);
  if (!session) { res.status(401).json({ error: "Sessão inválida ou expirada" }); return; }
  const lojaConfig = await getLojaConfig(session.lojaId);
  const features = getFeatureFlags(lojaConfig);
  res.json({
    userId: session.userId,
    nome: session.nome,
    cargo: session.cargo,
    papel: session.papel,
    operacao: session.operacao,
    lojaId: session.lojaId,
    wa: session.wa,
    waRaw: session.waRaw,
    tom: session.tom,
    header: session.header,
    assinatura: session.assinatura,
    features,
  });
});

router.post("/logout", async (req, res) => {
  const token = (req.headers["x-session-token"] || "") as string;
  if (token) {
    const session = getSession(token);
    if (session) {
      await registrarAudit({
        lojaId: session.lojaId,
        usuarioId: session.userId > 0 ? session.userId : undefined,
        acao: "LOGOUT",
        ip: clientIp(req),
      });
      destroySession(token);
    }
  }
  res.json({ ok: true });
});

/**
 * POST /auth/alterar-senha
 * Troca a senha do usuário autenticado.
 * Body: { senhaAtual, novaSenha }
 */
router.post("/alterar-senha", requireAuth, async (req, res) => {
  const token = (req.headers["x-session-token"] || "") as string;
  const session = getSession(token);
  if (!session || session.userId <= 0) {
    res.status(403).json({ error: "Operação disponível apenas para usuários do novo sistema" });
    return;
  }

  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || typeof senhaAtual !== "string" || !novaSenha || typeof novaSenha !== "string") {
    res.status(400).json({ error: "senhaAtual e novaSenha são obrigatórios" });
    return;
  }
  if (novaSenha.length < 8) {
    res.status(400).json({ error: "Nova senha deve ter pelo menos 8 caracteres" });
    return;
  }

  const usuario = await findUsuarioById(session.userId);
  if (!usuario || !usuario.senhaHash) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!senhaCorreta) {
    res.status(401).json({ error: "Senha atual incorreta" });
    return;
  }

  const novoHash = await bcrypt.hash(novaSenha, 10);
  await updateUsuarioSenha(session.userId, novoHash);
  destroyAllUserSessions(session.userId);

  await registrarAudit({
    lojaId: session.lojaId,
    usuarioId: session.userId,
    acao: "CHANGE_PASSWORD",
    ip: clientIp(req),
  });

  res.json({ ok: true, message: "Senha alterada. Faça login novamente." });
});

/**
 * GET /auth/reset-info?token=...
 * Retorna o email associado ao token (para exibir na página de redefinição).
 * Público — não exige autenticação.
 */
router.get("/reset-info", async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: "Token obrigatório" }); return; }

  const resetRec = await findResetTokenValido(token);
  if (!resetRec) { res.status(400).json({ error: "Token inválido ou expirado" }); return; }

  const usuario = await findUsuarioById(resetRec.usuarioId);
  if (!usuario) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

  res.json({ email: usuario.email });
});

/**
 * POST /auth/esqueci-senha
 * Gera token de reset. Em produção, enviaria por email.
 * Body: { email }
 */
router.post("/esqueci-senha", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email obrigatório" });
    return;
  }

  const usuario = await findUsuarioByEmail(email);
  // Sempre retorna 200 para não revelar se o email existe
  if (!usuario || !usuario.ativo) {
    res.json({ ok: true, message: "Se o email estiver cadastrado, o token foi gerado." });
    return;
  }

  const reset = await createResetToken(usuario.id);
  await registrarAudit({
    lojaId: usuario.lojaId,
    usuarioId: usuario.id,
    acao: "FORGOT_PASSWORD",
    ip: clientIp(req),
  });

  // TODO: enviar email com link em produção.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] Reset token for ${email}: /redefinir-senha?token=${reset.token}`);
  }

  res.json({ ok: true, message: "Se o email estiver cadastrado, o token foi gerado." });
});

/**
 * POST /auth/redefinir-senha
 * Body: { token, novaSenha }
 */
router.post("/redefinir-senha", async (req, res) => {
  const { token, novaSenha } = req.body;
  if (!token || !novaSenha || typeof novaSenha !== "string") {
    res.status(400).json({ error: "Token e novaSenha são obrigatórios" });
    return;
  }
  if (novaSenha.length < 8) {
    res.status(400).json({ error: "Nova senha deve ter pelo menos 8 caracteres" });
    return;
  }

  const resetRec = await findResetTokenValido(token);
  if (!resetRec) {
    res.status(400).json({ error: "Token inválido ou expirado" });
    return;
  }

  const usuario = await findUsuarioById(resetRec.usuarioId);

  const novoHash = await bcrypt.hash(novaSenha, 10);
  await updateUsuarioSenha(resetRec.usuarioId, novoHash);
  await marcarResetTokenUsado(resetRec.id);
  destroyAllUserSessions(resetRec.usuarioId);

  await registrarAudit({
    lojaId: usuario?.lojaId ?? undefined,
    usuarioId: resetRec.usuarioId,
    acao: "RESET_PASSWORD",
    ip: clientIp(req),
  });

  res.json({ ok: true, message: "Senha redefinida com sucesso. Faça login.", email: usuario?.email ?? null });
});

export default router;
