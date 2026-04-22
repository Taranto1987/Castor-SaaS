import { Router, type IRouter } from "express";
import healthRouter from "./health";
import produtosRouter from "./produtos";
import orcamentoRouter from "./orcamento";
import crawlerRouter from "./crawler";
import entregasRouter from "./entregas";
import dashboardRouter from "./dashboard";
import financeiroRouter from "./financeiro";
import authRouter from "./auth";
import entradaEstoqueRouter from "./entrada-estoque";
import chatRouter from "./chat";
import usuariosRouter from "./usuarios";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/usuarios", usuariosRouter);
router.use("/produtos", produtosRouter);
router.use("/orcamento", orcamentoRouter);
router.use("/crawler", crawlerRouter);
router.use("/entregas", entregasRouter);
router.use("/dashboard", dashboardRouter);
router.use("/financeiro", financeiroRouter);
router.use("/entrada-estoque", entradaEstoqueRouter);
router.use("/chat", chatRouter);
router.use("/agente", chatRouter);

export default router;
