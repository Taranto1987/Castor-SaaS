// Idempotent schema reconciler — aplica reconcile.sql (snapshot canônico gerado por
// `drizzle-kit generate`) ignorando objetos que já existem. Determinístico e SEM prompts
// interativos (o `drizzle-kit push` travava no prompt de unique constraint e nunca aplicava
// nada — resultado: tabelas centrais como `diagnosticos`/`ai_usage` nunca foram criadas em prod).
//
// reconcile.sql contém apenas CREATE TABLE / CREATE INDEX / ADD CONSTRAINT (aditivo, zero DROP).
// Statements que já existem retornam erro "duplicate_*" e são ignorados com segurança.
//
// Para regenerar após mudar o schema:  pnpm --filter @workspace/db run push:generate
//
// ── Por que colunas novas em tabelas existentes sumiam silenciosamente ──────────
// `push:generate` roda `drizzle-kit generate` do zero (não há journal de migrations
// commitado), então ele sempre emite CREATE TABLE completo por tabela — nunca ALTER
// TABLE ADD COLUMN. Quando a tabela já existe em produção, esse CREATE TABLE falha com
// duplicate_table e é ignorado (IGNORE abaixo) — e a coluna nova nunca chega a ser
// adicionada, mesmo que o app já espere ela. Isso já causou incidente 2x (produtos
// sumiram para loja Araruama; produtos.largura/comprimento e diagnosticos.resultado
// faltando em prod causando 500 no catálogo inteiro), porque dependia de alguém
// lembrar de colar um ALTER TABLE ADD COLUMN IF NOT EXISTS manual depois de regenerar.
//
// Fix estrutural: expandCreateTable() decompõe cada CREATE TABLE em
// (a) CREATE TABLE IF NOT EXISTS — cria a tabela inteira se ela não existir, e
// (b) um ALTER TABLE ADD COLUMN IF NOT EXISTS por coluna declarada — que roda SEMPRE,
// mesmo para tabelas já existentes. Isso torna a convergência automática: qualquer
// coluna nova adicionada ao schema Drizzle chega em produção no próximo deploy, sem
// nenhum passo manual. `push:generate` não precisa mais ser hand-patched.
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

// Divide a lista de colunas/constraints de um CREATE TABLE respeitando parênteses
// aninhados (ex.: numeric(10, 6)) e strings entre aspas simples (ex.: DEFAULT '{}'::jsonb).
function splitTopLevel(body) {
  const parts = [];
  let depth = 0, cur = "", inStr = false;
  for (const c of body) {
    if (inStr) {
      cur += c;
      if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// Decompõe `CREATE TABLE [IF NOT EXISTS] "nome" (...)` em statements idempotentes por coluna.
// Statements que não são CREATE TABLE (ALTER, CREATE INDEX, CREATE TYPE) passam direto.
function expandCreateTable(stmt) {
  const m = stmt.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"\s*\(([\s\S]*)\)\s*;?\s*$/i);
  if (!m) return [stmt];

  const [, table, body] = m;
  const out = [`CREATE TABLE IF NOT EXISTS "${table}" (${body});`];

  for (const entry of splitTopLevel(body)) {
    if (/^CONSTRAINT\s/i.test(entry)) {
      // Constraints não suportam "IF NOT EXISTS" no ADD; duplicate_object (42710) cobre o retry seguro.
      out.push(`ALTER TABLE "${table}" ADD ${entry};`);
    } else if (/^"[^"]+"/.test(entry)) {
      out.push(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${entry};`);
    }
    // Outras entradas de nível de tabela (ex.: PRIMARY KEY (...) solto) não ocorrem hoje
    // no output do drizzle-kit para este schema; se aparecerem, são ignoradas com segurança
    // (a tabela já existe, e colunas individuais já convergem via ADD COLUMN acima).
  }

  return out;
}

const rawSql = readFileSync(new URL("./reconcile.sql", import.meta.url), "utf8");
const statements = rawSql
  .split("--> statement-breakpoint")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean)
  .flatMap(expandCreateTable);

// Tabelas tocadas por algum CREATE TABLE — usadas na verificação de convergência abaixo.
const expectedColumnsByTable = new Map();
for (const stmt of statements) {
  const alterMatch = stmt.match(/^ALTER TABLE "([^"]+)" ADD COLUMN IF NOT EXISTS "([^"]+)"/i);
  if (!alterMatch) continue;
  const [, table, column] = alterMatch;
  if (!expectedColumnsByTable.has(table)) expectedColumnsByTable.set(table, new Set());
  expectedColumnsByTable.get(table).add(column);
}

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

// ── Verificação de convergência ──────────────────────────────────────────────
// Confere, contra information_schema, se toda coluna que o schema espera realmente
// existe no banco após a reconciliação. Isso é o que impede a próxima ocorrência de
// "sumiu silenciosamente": se algo não convergiu (ex.: erro de tipo, permissão), fica
// GRITANDO em log estruturado — nunca mais descoberto só quando um cliente reclama.
try {
  let missingTotal = 0;
  for (const [table, expectedCols] of expectedColumnsByTable) {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const actualCols = new Set(rows.map((r) => r.column_name));
    const missing = [...expectedCols].filter((c) => !actualCols.has(c));
    if (missing.length > 0) {
      missingTotal += missing.length;
      console.error(`[reconcile] DRIFT NÃO RESOLVIDO em "${table}": colunas ainda ausentes = [${missing.join(", ")}]`);
    }
  }
  console.log(`[reconcile] verificação de convergência: ${expectedColumnsByTable.size} tabelas checadas, ${missingTotal} colunas ainda ausentes`);
} catch (err) {
  console.error(`[reconcile] verificação de convergência falhou (${err.code}): ${err.message}`);
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
