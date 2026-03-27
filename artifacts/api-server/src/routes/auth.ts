import { Router, type IRouter } from "express";
import { createSession, getSession, destroySession } from "../lib/sessions";

const router: IRouter = Router();

router.post("/login", (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Código obrigatório" });
    return;
  }

  const session = createSession(code);
  if (!session) {
    res.status(401).json({ error: "Código inválido" });
    return;
  }

  res.json({
    token: session.token,
    nome: session.nome,
    papel: session.papel,
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
  });
});

router.post("/logout", (req, res) => {
  const token = (req.headers["x-session-token"] || "") as string;
  if (token) destroySession(token);
  res.json({ ok: true });
});

export default router;
