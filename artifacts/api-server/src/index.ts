import app from "./app";
import { iniciarSchedulerRecorrentes } from "./lib/recorrentes-scheduler";
import { iniciarSchedulerFollowUps } from "./lib/followup-scheduler";
import { iniciarSchedulerTrafficManager } from "./lib/traffic-manager-scheduler";
import { seedColaboradores } from "./lib/sessions";

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
  iniciarSchedulerTrafficManager();
  seedColaboradores().catch(console.error);
});
