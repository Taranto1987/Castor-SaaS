import app from "./app";
import { validateEnv } from "./utils/env.js";
import { iniciarSchedulerRecorrentes } from "./lib/recorrentes-scheduler";
import { iniciarSchedulerFollowUps } from "./lib/followup-scheduler";
import { seedColaboradores } from "./lib/sessions";
import { iniciarJobInteligente } from "./jobs/inteligente.js";
import { seedLojas } from "./lib/seed-lojas";

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
  console.log(`Server listening on port ${port}`);
  iniciarSchedulerRecorrentes();
  iniciarSchedulerFollowUps();
  iniciarJobInteligente();
  seedLojas().catch(console.error);
  seedColaboradores().catch(console.error);
});
