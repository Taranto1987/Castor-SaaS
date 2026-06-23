// Idempotent schema reconciler — aplica reconcile.sql (snapshot canônico gerado por
// `drizzle-kit generate`) ignorando objetos que já existem. Determinístico e SEM prompts
// interativos (o `drizzle-kit push` travava no prompt de unique constraint e nunca aplicava
// nada — resultado: tabelas centrais como `diagnosticos`/`ai_usage` nunca foram criadas em prod).
//
// reconcile.sql contém apenas CREATE TABLE / CREATE INDEX / ADD CONSTRAINT (aditivo, zero DROP).
// Statements que já existem retornam erro "duplicate_*" e são ignorados com segurança.
//
// IMPORTANTE: CREATE TABLE em tabela já existente é ignorado (duplicate_table), então colunas
// NOVAS adicionadas ao schema de uma tabela existente NUNCA eram aplicadas (foi a causa de
// `column "vendido_em" does not exist` em prod). Por isso, após aplicar o snapshot, fazemos uma
// reconciliação de COLUNAS: parseamos os CREATE TABLE do próprio reconcile.sql (fonte canônica,
// sem hardcode) e emitimos ALTER TABLE ADD COLUMN IF NOT EXISTS apenas para as colunas faltantes.
// Aditivo e seguro: colunas sem DEFAULT entram como NULL-able (não quebra linhas existentes),
// zero DROP, e nunca derruba o deploy.
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

// ── Reconciliação de COLUNAS ──────────────────────────────────────────────────
// Parseia os CREATE TABLE de reconcile.sql e adiciona colunas que faltam em tabelas
// já existentes (o CREATE TABLE acima é ignorado quando a tabela já existe, então
// colunas novas só chegam ao banco aqui). Fonte de verdade = o próprio snapshot.
function parseCreateTables(rawStatements) {
  const tables = [];
  for (const stmt of rawStatements) {
    const m = stmt.match(/^CREATE TABLE\s+"([^"]+)"\s*\(([\s\S]*)\)\s*;?\s*$/i);
    if (!m) continue;
    const [, table, body] = m;
    const cols = [];
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");
      if (!line || !line.startsWith('"')) continue; // pula CONSTRAINT/linhas vazias
      const cm = line.match(/^"([^"]+)"\s+(.+)$/);
      if (!cm) continue;
      const [, name, def] = cm;
      if (/\bPRIMARY KEY\b/i.test(def)) continue; // PK sempre já existe; não recriar
      const type = def.split(/\s+(?:DEFAULT|NOT NULL|UNIQUE|REFERENCES|GENERATED)\b/i)[0].trim();
      const dm = def.match(/\bDEFAULT\s+(.+?)(?:\s+NOT NULL)?$/i);
      const defaultExpr = dm ? dm[1].trim() : null;
      const notNull = /\bNOT NULL\b/i.test(def);
      cols.push({ name, type, defaultExpr, notNull });
    }
    if (cols.length) tables.push({ table, cols });
  }
  return tables;
}

let colsAdded = 0, colsSkipped = 0, colsFailed = 0;
try {
  const parsed = parseCreateTables(statements);
  const { rows } = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const existing = new Map();
  for (const r of rows) {
    if (!existing.has(r.table_name)) existing.set(r.table_name, new Set());
    existing.get(r.table_name).add(r.column_name);
  }

  for (const { table, cols } of parsed) {
    const have = existing.get(table);
    if (!have) continue; // tabela ausente (CREATE deve ter falhado); não forçar
    for (const c of cols) {
      if (have.has(c.name)) { colsSkipped++; continue; }
      let clause = `"${c.name}" ${c.type}`;
      if (c.defaultExpr) clause += ` DEFAULT ${c.defaultExpr}`;
      // NOT NULL só quando há DEFAULT — adicionar NOT NULL sem default quebraria
      // tabelas com linhas existentes. Sem default, a coluna entra como NULL-able.
      if (c.notNull && c.defaultExpr) clause += " NOT NULL";
      try {
        await pool.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${clause}`);
        colsAdded++;
        console.log(`[reconcile] coluna adicionada: ${table}.${c.name}`);
      } catch (err) {
        if (IGNORE.has(err.code)) { colsSkipped++; }
        else { colsFailed++; console.error(`[reconcile] ALTER ADD ${table}.${c.name} falhou (${err.code}): ${err.message}`); }
      }
    }
  }
  console.log(`[reconcile] colunas: adicionadas=${colsAdded} já_existiam=${colsSkipped} falhas=${colsFailed}`);
} catch (err) {
  console.error(`[reconcile] reconciliação de colunas falhou (${err.code}): ${err.message}`);
}

// ── Backfill COCA→CRM ────────────────────────────────────────────────────────
// Cria um lead para cada oportunidade existente que ainda não tem lead correspondente
// (dedup por loja_id + whatsapp). Idempotente: re-rodar não duplica. Resolve o sintoma
// "N oportunidades na COCA, 0 leads no CRM" para os orçamentos já salvos.
try {
  const r = await pool.query(`
    INSERT INTO leads (loja_id, customer_profile_id, nome, whatsapp, origem, estagio, ultimo_contato)
    SELECT DISTINCT ON (o.loja_id, o.whatsapp)
           o.loja_id, o.customer_id, o.cliente, o.whatsapp, 'orcamento', 'proposta', now()
      FROM sales_opportunities o
     WHERE o.whatsapp IS NOT NULL AND o.whatsapp <> ''
       AND NOT EXISTS (
         SELECT 1 FROM leads l WHERE l.loja_id = o.loja_id AND l.whatsapp = o.whatsapp
       )
     ORDER BY o.loja_id, o.whatsapp, o.id DESC;
  `);
  console.log(`[reconcile] backfill leads (a partir de oportunidades): +${r.rowCount}`);
} catch (err) {
  console.error(`[reconcile] backfill leads falhou (${err.code}): ${err.message}`);
}

// ── Backfill orcamentos.customer_id via whatsapp ──────────────────────────────
try {
  const r = await pool.query(`
    UPDATE orcamentos o
       SET customer_id = cp.id
      FROM customer_profiles cp
     WHERE cp.loja_id = o.loja_id
       AND cp.phone   = o.whatsapp
       AND o.customer_id IS NULL
       AND o.whatsapp IS NOT NULL;
  `);
  console.log(`[reconcile] backfill orcamentos.customer_id: ${r.rowCount}`);
} catch (err) {
  console.error(`[reconcile] backfill orcamentos.customer_id falhou (${err.code}): ${err.message}`);
}

// ── Backfill orcamentos.lead_id via sales_opportunities ───────────────────────
try {
  const r = await pool.query(`
    UPDATE orcamentos o
       SET lead_id = so.lead_id
      FROM sales_opportunities so
     WHERE so.orcamento_id = o.id
       AND so.loja_id      = o.loja_id
       AND so.lead_id IS NOT NULL
       AND o.lead_id IS NULL;
  `);
  console.log(`[reconcile] backfill orcamentos.lead_id: ${r.rowCount}`);
} catch (err) {
  console.error(`[reconcile] backfill orcamentos.lead_id falhou (${err.code}): ${err.message}`);
}

// ── Backfill entregas.customer_id via orcamentos ──────────────────────────────
try {
  const r = await pool.query(`
    UPDATE entregas e
       SET customer_id = o.customer_id
      FROM orcamentos o
     WHERE o.id          = e.orcamento_id
       AND o.loja_id     = e.loja_id
       AND o.customer_id IS NOT NULL
       AND e.customer_id IS NULL;
  `);
  console.log(`[reconcile] backfill entregas.customer_id: ${r.rowCount}`);
} catch (err) {
  console.error(`[reconcile] backfill entregas.customer_id falhou (${err.code}): ${err.message}`);
}

await pool.end();
// Nunca falha o deploy por causa de reconciliação — apenas reporta.
process.exit(0);
