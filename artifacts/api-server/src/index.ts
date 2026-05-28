import app from "./app";
import { validateEnv } from "./utils/env.js";
import { iniciarSchedulerRecorrentes, stopSchedulerRecorrentes } from "./lib/recorrentes-scheduler";
import { iniciarSchedulerFollowUps, stopSchedulerFollowUps } from "./lib/followup-scheduler";
import { stopWahaSessionCleanup } from "./routes/waha";
import { seedColaboradores, hydrateSessionsFromDB, cleanupExpiredSessions } from "./lib/sessions";
import { seedLojas } from "./lib/seed-lojas";
import { refreshLojaRegistry } from "./middlewares/auth";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

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
  refreshLojaRegistry().catch(() => null);
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
