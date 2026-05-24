import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import sitemapRouter from "./routes/sitemap.js";

const app: Express = express();

// Security: HTTP headers
app.use(helmet());

// Security: CORS with allowlist
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : undefined,
  credentials: true,
}));

// Security: Body size limit (5MB instead of 20MB)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

function makeLimiter(max: number, windowMs = 15 * 60 * 1000, message = "Too many requests, try again later") {
  return rateLimit({ windowMs, max, message, standardHeaders: true, legacyHeaders: false });
}

// Auth endpoints — strict limits to prevent brute force and token enumeration
app.use("/api/auth/login",          makeLimiter(20));           // 20/15min
app.use("/api/auth/esqueci-senha",  makeLimiter(5));            // 5/15min — prevent email enumeration abuse
app.use("/api/auth/redefinir-senha", makeLimiter(10));          // 10/15min — prevent token brute force
app.use("/api/auth/alterar-senha",  makeLimiter(10));           // 10/15min
app.use("/api/usuarios/aceitar-convite", makeLimiter(10));      // 10/15min — prevent invite token brute force
// AI agent endpoints — each call creates an Anthropic session (billed per token)
app.use("/api/agent/",              makeLimiter(20, 60 * 60 * 1000)); // 20/hour per IP
// Public AI chat (ThallesZzz sales assistant) — streams Anthropic calls
app.use("/api/chat",                makeLimiter(30));                  // 30/15min per IP
// Sitemap at root (not under /api) for search engine discovery
app.use(sitemapRouter);
app.use("/api", router);

export default app;
