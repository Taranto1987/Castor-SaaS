export * from "./utils/family";
export * from "./utils/normalizeSize";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[pg-pool] idle client error", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
