import app from "./app";
import { iniciarSchedulerRecorrentes } from "./lib/recorrentes-scheduler";
import { iniciarSchedulerFollowUps } from "./lib/followup-scheduler";
import { seedColaboradores } from "./lib/sessions";
import { seedLojas } from "./lib/seed-lojas";

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
  seedLojas().catch(console.error);
  seedColaboradores().catch(console.error);
});
