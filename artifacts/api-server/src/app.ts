import express, { type Express } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { identificarTenant } from "./middleware/tenant.js";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Identifica o tenant via hostname em todas as rotas /api
app.use("/api", identificarTenant as express.RequestHandler);
app.use("/api", router);

export default app;
