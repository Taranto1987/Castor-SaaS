import express, { type Express } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { identificarTenant } from "./middleware/tenant.js";

const ALLOWED_ORIGINS = [
  /\.vercel\.app$/,
  /\.railway\.app$/,
  /localhost/,
  /127\.0\.0\.1/,
];

const app: Express = express();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.some((r) => r.test(origin))) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origem não permitida — ${origin}`));
      }
    },
    allowedHeaders: ["Content-Type", "x-session-token"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Identifica o tenant via hostname em todas as rotas /api
app.use("/api", identificarTenant as express.RequestHandler);
app.use("/api", router);

export default app;
