import {
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const trafficManagerConfigTable = pgTable("traffic_manager_config", {
  id: serial("id").primaryKey(),
  adAccountId: text("ad_account_id").notNull(),
  platform: text("platform").notNull().default("meta"),
  maxDailyBudgetIncreasePct: numeric("max_daily_budget_increase_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("20"),
  maxCpaThresholdBrl: numeric("max_cpa_threshold_brl", { precision: 10, scale: 2 })
    .notNull()
    .default("150"),
  minRoasTarget: numeric("min_roas_target", { precision: 6, scale: 2 })
    .notNull()
    .default("3"),
  notifyPhone: text("notify_phone"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").defaultNow(),
  atualizadoEm: timestamp("atualizado_em").defaultNow(),
});

export type TrafficManagerConfig = typeof trafficManagerConfigTable.$inferSelect;
export type InsertTrafficManagerConfig = typeof trafficManagerConfigTable.$inferInsert;

export const adMetricSnapshotsTable = pgTable("ad_metric_snapshots", {
  id: serial("id").primaryKey(),
  adAccountId: text("ad_account_id").notNull(),
  platform: text("platform").notNull().default("meta"),
  campaignId: text("campaign_id"),
  campaignName: text("campaign_name"),
  adSetId: text("ad_set_id"),
  adSetName: text("ad_set_name"),
  spend: numeric("spend", { precision: 12, scale: 2 }),
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  conversions: numeric("conversions", { precision: 10, scale: 2 }),
  cpa: numeric("cpa", { precision: 12, scale: 2 }),
  ctr: numeric("ctr", { precision: 8, scale: 4 }),
  roas: numeric("roas", { precision: 8, scale: 4 }),
  rawData: jsonb("raw_data"),
  capturedAt: timestamp("captured_at").defaultNow(),
});

export type AdMetricSnapshot = typeof adMetricSnapshotsTable.$inferSelect;

export const trafficManagerDecisionsTable = pgTable("traffic_manager_decisions", {
  id: serial("id").primaryKey(),
  adAccountId: text("ad_account_id"),
  platform: text("platform").default("meta"),
  trigger: text("trigger").notNull().default("scheduled_check"),
  vigiAnalysis: text("vigi_analysis"),
  estrategistaDecision: text("estrategista_decision"),
  actionsExecuted: jsonb("actions_executed"),
  anomalyDetected: boolean("anomaly_detected").notNull().default(false),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  decidedAt: timestamp("decided_at").defaultNow(),
});

export type TrafficManagerDecision = typeof trafficManagerDecisionsTable.$inferSelect;

export const capiEventsTable = pgTable("capi_events", {
  id: serial("id").primaryKey(),
  eventName: text("event_name").notNull(),
  pixelId: text("pixel_id").notNull(),
  leadPhone: text("lead_phone"),
  leadName: text("lead_name"),
  leadScore: numeric("lead_score", { precision: 5, scale: 2 }),
  valueEstimated: numeric("value_estimated", { precision: 12, scale: 2 }),
  eventId: text("event_id"),
  status: text("status").notNull().default("pending"),
  metaResponse: jsonb("meta_response"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  criadoEm: timestamp("criado_em").defaultNow(),
});

export type CapiEvent = typeof capiEventsTable.$inferSelect;
