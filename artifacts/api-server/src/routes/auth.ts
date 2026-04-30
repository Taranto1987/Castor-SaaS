import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { createSession, getSession, destroySession } from "../lib/sessions";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

const router: IRouter = Router();

router.post("/login", loginLimiter, async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Código obrigatório" });
    return;
  }

  const session = await createSession(code);
  if (!session) {
    res.status(401).json({ error: "Código inválido" });
    return;
  }

  res.json({
    token: session.token,
    nome: session.nome,
    papel: session.papel,
    operacao: session.operacao,
    wa: session.wa,
    waRaw: session.waRaw,
    tom: session.tom,
    header: session.header,
    assinatura: session.assinatura,
  });
});

router.get("/me", (req, res) => {
  const token = (req.headers["x-session-token"] || "") as string;
  if (!token) {
    res.status(401).json({ error: "Token ausente" });
    return;
  }

  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return;
  }

  res.json({
    nome: session.nome,
    papel: session.papel,
    operacao: session.operacao,
    wa: session.wa,
    waRaw: session.waRaw,
    tom: session.tom,
    header: session.header,
    assinatura: session.assinatura,
  });
});

router.post("/logout", (req, res) => {
  const token = (req.headers["x-session-token"] || "") as string;
  if (token) destroySession(token);
  res.json({ ok: true });
});

export default router;
