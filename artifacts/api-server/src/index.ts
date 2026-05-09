import app from "./app";
import { validateEnv } from "./utils/env.js";
import { iniciarSchedulerRecorrentes } from "./lib/recorrentes-scheduler";
import { seedColaboradores } from "./lib/sessions";
import { iniciarJobInteligente } from "./jobs/inteligente.js";

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
  iniciarJobInteligente();
  seedColaboradores().catch(console.error);
});
