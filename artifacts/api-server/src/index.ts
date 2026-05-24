import app from "./app";
import { validateEnv } from "./utils/env.js";
import { iniciarSchedulerRecorrentes } from "./lib/recorrentes-scheduler";
import { iniciarSchedulerFollowUps } from "./lib/followup-scheduler";
import { seedColaboradores, hydrateSessionsFromDB, cleanupExpiredSessions } from "./lib/sessions";
import { seedLojas } from "./lib/seed-lojas";
import { logger } from "./lib/logger";

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

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  iniciarSchedulerRecorrentes();
  iniciarSchedulerFollowUps();
  cleanupExpiredSessions().catch(() => null);
  hydrateSessionsFromDB().catch(() => null);
  seedLojas().catch((err: unknown) => logger.error({ err }, "seedLojas failed"));
  seedColaboradores().catch((err: unknown) => logger.error({ err }, "seedColaboradores failed"));
});
