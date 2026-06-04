// Idempotent schema reconciler — aplica reconcile.sql (snapshot canônico gerado por
// `drizzle-kit generate`) ignorando objetos que já existem. Determinístico e SEM prompts
// interativos (o `drizzle-kit push` travava no prompt de unique constraint e nunca aplicava
// nada — resultado: tabelas centrais como `diagnosticos`/`ai_usage` nunca foram criadas em prod).
//
// reconcile.sql contém apenas CREATE TABLE / CREATE INDEX / ADD CONSTRAINT (aditivo, zero DROP).
// Statements que já existem retornam erro "duplicate_*" e são ignorados com segurança.
//
// Para regenerar após mudar o schema:  pnpm --filter @workspace/db run push:generate
import { readFileSync } from "node:fs";
import pg from "pg";

const IGNORE = new Set([
  "42P07", // duplicate_table
  "42710", // duplicate_object (constraint/index)
  "42P06", // duplicate_schema
  "42701", // duplicate_column
  "42P16", // invalid_table_definition (já tem PK etc.)
  "23505", // unique_violation (constraint já satisfeita)
]);

if (!process.env.DATABASE_URL) {
  console.error("[reconcile] DATABASE_URL ausente — pulando reconciliação.");
  process.exit(0); // não derruba o deploy
}

const sql = readFileSync(new URL("./reconcile.sql", import.meta.url), "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });

let applied = 0, skipped = 0, failed = 0;
for (const stmt of statements) {
  try {
    await pool.query(stmt);
    applied++;
  } catch (err) {
    if (IGNORE.has(err.code)) { skipped++; }
    else { failed++; console.error(`[reconcile] falhou (${err.code}): ${err.message}`); }
  }
}
console.log(`[reconcile] aplicados=${applied} já_existiam=${skipped} falhas=${failed}`);
await pool.end();
// Nunca falha o deploy por causa de reconciliação — apenas reporta.
process.exit(0);
