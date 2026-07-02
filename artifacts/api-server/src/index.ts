import app from "./app";
import { validateEnv } from "./utils/env.js";
import { iniciarSchedulerRecorrentes, stopSchedulerRecorrentes } from "./lib/recorrentes-scheduler";
import { iniciarSchedulerFollowUps, stopSchedulerFollowUps } from "./lib/followup-scheduler";
import { stopWahaSessionCleanup } from "./routes/waha";
import { seedColaboradores, hydrateSessionsFromDB, cleanupExpiredSessions } from "./lib/sessions";
import { seedLojas } from "./lib/seed-lojas";
import { refreshLojaRegistry } from "./middlewares/auth";
import { logger } from "./lib/logger";
import { pool, db } from "@workspace/db";
import { crawlerStatusTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { registerEvolutionWebhooks } from "./services/whatsapp/webhook-registrar";
import { backfillMedidasProdutos } from "./medidas";

// Auto-alinhamento pós-deploy: classifica por medida os produtos ainda sem
// categoria_interna (linhas antigas, criadas antes da coluna existir). One-shot
// e idempotente — o guard `categoria_interna IS NULL` garante que só roda uma vez.
// Roda em background para não atrasar o boot.
async function backfillMedidasNoBoot(): Promise<void> {
  try {
    const r = await backfillMedidasProdutos();
    if (r.processados > 0) {
      logger.info(
        {
          processados: r.processados,
          classificados: r.classificados,
          naoMapeados: r.naoMapeados,
          revisaoManual: r.revisaoManual.length,
        },
        "[Medidas] Backfill de categoria_interna no boot concluído",
      );
    }
  } catch (err) {
    logger.warn({ err }, "[Medidas] Backfill no boot falhou (não bloqueia o boot)");
  }
}

async function resetStaleCrawler(): Promise<void> {
  try {
    await db.update(crawlerStatusTable)
      .set({ status: "error", mensagem: "Interrompido por reinício do servidor.", atualizadoEm: new Date() })
      .where(eq(crawlerStatusTable.status, "running"));
    logger.info("[Crawler] Verificação de status stale no boot concluída.");
  } catch (err) {
    logger.warn({ err }, "[Crawler] Não foi possível resetar status stale no boot.");
  }
}

// Must run before anything else — exits with code 1 if required vars are missing
validateEnv();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
  iniciarSchedulerRecorrentes();
  iniciarSchedulerFollowUps();
  cleanupExpiredSessions().catch(() => null);
  hydrateSessionsFromDB().catch(() => null);
  seedLojas().catch((err: unknown) => logger.error({ err }, "seedLojas failed"));
  seedColaboradores().catch((err: unknown) => logger.error({ err }, "seedColaboradores failed"));
  resetStaleCrawler().catch(() => null);
  refreshLojaRegistry().catch(() => null);
  registerEvolutionWebhooks().catch(() => null);
  backfillMedidasNoBoot().catch(() => null);
  _refreshHandle = setInterval(() => refreshLojaRegistry().catch(() => null), 5 * 60_000);
});

let shuttingDown = false;
let _refreshHandle: ReturnType<typeof setInterval> | null = null;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");

  if (_refreshHandle) { clearInterval(_refreshHandle); _refreshHandle = null; }
  stopSchedulerRecorrentes();
  stopSchedulerFollowUps();
  stopWahaSessionCleanup();

  server.close(async () => {
    try { await pool.end(); } catch { /* ignore */ }
    logger.info("Server closed cleanly");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Shutdown timeout — forcing exit");
    process.exit(1);
  }, 30_000);
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT"); });

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandledRejection — investigate immediately");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException — shutting down");
  void shutdown("uncaughtException");
});
