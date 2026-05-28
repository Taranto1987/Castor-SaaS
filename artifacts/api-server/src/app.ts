import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import sitemapRouter from "./routes/sitemap.js";
import { requestContextMiddleware } from "./middleware/request-context";

const app: Express = express();

// Trust Railway/Vercel reverse proxy — required for correct req.ip, rate limiting, and CORS headers
app.set("trust proxy", 1);

// Observability: request ID + correlation ID on every request
app.use(requestContextMiddleware);

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
// WhatsApp onboarding — connect/disconnect are expensive (Evolution API calls)
app.use("/api/whatsapp/connect",    makeLimiter(5,  15 * 60 * 1000)); // 5/15min per IP
app.use("/api/whatsapp/disconnect", makeLimiter(10, 15 * 60 * 1000)); // 10/15min per IP
app.use("/api/whatsapp/status",     makeLimiter(120, 60 * 1000));     // 120/min (3s polling × 40 cycles)
// MCP Server — external agent access, higher per-window but capped
app.use("/api/mcp",                 makeLimiter(60, 60 * 60 * 1000)); // 60/hour per IP
// Sitemap at root (not under /api) for search engine discovery
app.use(sitemapRouter);
app.use("/api", router);

export default app;
