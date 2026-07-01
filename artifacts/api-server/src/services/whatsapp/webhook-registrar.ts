import { fetchInstances, setWebhookForInstance } from "./evolution-client";
import { logger } from "../../lib/logger";

export async function registerEvolutionWebhooks(): Promise<void> {
  const instances = await fetchInstances();
  if (instances.length === 0) return;

  for (const name of instances) {
    try {
      await setWebhookForInstance(name);
      logger.info({ instance: name }, "evolution: webhook registered");
    } catch (err) {
      logger.warn({ err, instance: name }, "evolution: webhook registration failed");
    }
  }
}
