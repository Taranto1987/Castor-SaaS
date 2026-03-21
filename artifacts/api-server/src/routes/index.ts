import { Router, type IRouter } from "express";
import healthRouter from "./health";
import produtosRouter from "./produtos";
import orcamentoRouter from "./orcamento";
import crawlerRouter from "./crawler";
import entregasRouter from "./entregas";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/produtos", produtosRouter);
router.use("/orcamento", orcamentoRouter);
router.use("/crawler", crawlerRouter);
router.use("/entregas", entregasRouter);
router.use("/dashboard", dashboardRouter);

export default router;
