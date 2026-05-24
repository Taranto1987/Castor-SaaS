import IORedis from "ioredis";
import { logger } from "../logger";

function createRedisConnection(): IORedis | null {
  const url = process.env["REDIS_URL"];
  if (!url) {
    logger.warn("REDIS_URL not set — Redis/BullMQ unavailable. Set it to enable job queues.");
    return null;
  }
  const client = new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  client.on("error", (err: Error) => logger.error({ err }, "Redis connection error"));
  client.on("connect", () => logger.info("Redis connected"));
  return client;
}

export const redisConnection = createRedisConnection();
