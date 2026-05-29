import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const schedulerLocksTable = pgTable("scheduler_locks", {
  id:           serial("id").primaryKey(),
  schedulerId:  text("scheduler_id").notNull().unique(),
  lockedAt:     timestamp("locked_at").defaultNow().notNull(),
  lockedBy:     text("locked_by").notNull(),
  expiresAt:    timestamp("expires_at").notNull(),
  lastRunAt:    timestamp("last_run_at"),
  lastRunOk:    boolean("last_run_ok"),
});

export type SchedulerLock = typeof schedulerLocksTable.$inferSelect;
