#!/usr/bin/env node
/**
 * reconcile.mjs — Castor DB pre-deploy reconciler
 *
 * Fluxo:
 *   1. Executa `drizzle-kit push --force` para criar tabelas e índices ausentes
 *      (comportamento original, não alterado).
 *   2. Conecta ao banco via `pg` e compara information_schema.columns com o
 *      schema Drizzle embutido abaixo.
 *   3. Para cada coluna ausente emite:
 *        ALTER TABLE <tabela> ADD COLUMN IF NOT EXISTS <col> <tipo>;
 *   4. Loga o resultado: [reconcile] aplicados=X já_existiam=Y colunas_adicionadas=Z falhas=0
 *
 * Idempotente: re-rodar não duplica nada (IF NOT EXISTS em todo lugar).
 */

import { execSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;

// ─── 1. drizzle-kit push ────────────────────────────────────────────────────

console.log("[reconcile] iniciando drizzle-kit push...");
try {
  execSync("pnpm drizzle-kit push --force --config ./drizzle.config.ts", {
    stdio: "inherit",
    cwd: new URL(".", import.meta.url).pathname,
  });
  console.log("[reconcile] drizzle-kit push concluído");
} catch (err) {
  console.error("[reconcile] drizzle-kit push falhou:", err.message);
  process.exit(1);
}

// ─── 2. Schema estático — fonte de verdade para reconcile de colunas ────────
//
// Formato: { <tableName>: { <columnName>: "<pg_type_ddl>" } }
//
// Regras de mapeamento Drizzle → PostgreSQL DDL:
//   serial(...)            → "integer"          (SERIAL é alias; coluna real é integer)
//   bigserial(...)         → "bigint"
//   integer(...)           → "integer"
//   real(...)              → "real"
//   numeric(...)           → "numeric"
//   text(...)              → "text"
//   boolean(...)           → "boolean"
//   timestamp(...)         → "timestamp without time zone"
//   jsonb(...)             → "jsonb"
//   pgEnum(...)            → "text"             (enums são criados pelo drizzle-kit push)
//
// Colunas com .notNull() NÃO recebem NOT NULL aqui — ALTERs aditivos são sempre
// nullable para não quebrar linhas existentes. O drizzle-kit push já cuida das
// constraints em tabelas novas.
//
// Atualizar esta lista sempre que adicionar colunas ao schema Drizzle.

const SCHEMA = {
  // ── lojas ────────────────────────────────────────────────────────────────
  lojas: {
    id:                "integer",
    slug:              "text",
    nome:              "text",
    operacao:          "text",
    responsavel:       "text",
    whatsapp_numero:   "text",
    whatsapp_display:  "text",
    cidades_json:      "jsonb",
    endereco:          "text",
    cidade:            "text",
    prompt_delta:      "text",
    config_json:       "jsonb",
    ativa:             "boolean",
    criado_em:         "timestamp without time zone",
  },

  // ── produtos ─────────────────────────────────────────────────────────────
  produtos: {
    id:                   "integer",
    loja_id:              "integer",
    nome:                 "text",
    sku:                  "text",
    slug:                 "text",
    preco:                "text",
    preco_pix:            "text",
    parcelamento:         "text",
    medidas:              "text",
    altura:               "text",
    categoria:            "text",
    imagem:               "text",
    link:                 "text",
    disponivel:           "boolean",
    encomenda:            "boolean",
    custo_brl:            "text",
    prazo_encomenda:      "text",
    estoque:              "integer",
    preco_base:           "numeric",
    factory_cost:         "numeric",
    outlet_markup_percent:"numeric",
    outlet_price:         "numeric",
    family_slug:          "text",
    family_name:          "text",
    size:                 "text",
    sales_mode:           "text",
    delivery_strategy:    "text",
    criado_em:            "timestamp without time zone",
    sincronizado_em:      "timestamp without time zone",
  },

  // ── outlet_interesses ────────────────────────────────────────────────────
  outlet_interesses: {
    id:        "integer",
    loja_id:   "integer",
    produto_id:"integer",
    criado_em: "timestamp without time zone",
  },

  // ── crawler_status ───────────────────────────────────────────────────────
  crawler_status: {
    id:                 "integer",
    loja_id:            "integer",
    status:             "text",
    mensagem:           "text",
    total_produtos:     "text",
    produtos_coletados: "text",
    erros:              "text",
    iniciado_em:        "timestamp without time zone",
    finalizado_em:      "timestamp without time zone",
    atualizado_em:      "timestamp without time zone",
  },

  // ── orcamentos ───────────────────────────────────────────────────────────
  orcamentos: {
    id:                "integer",
    loja_id:           "integer",
    cliente:           "text",
    whatsapp:          "text",
    produtos_json:     "jsonb",
    observacoes:       "text",
    desconto_pix:      "integer",
    total_pix:         "text",
    total_prazo:       "text",
    texto:             "text",
    vendedor:          "text",
    status:            "text",
    preco_base_total:  "text",
    desconto_aplicado: "text",
    criado_em:         "timestamp without time zone",
    vendido_em:        "timestamp without time zone",
  },

  // ── entregas ─────────────────────────────────────────────────────────────
  entregas: {
    id:           "integer",
    loja_id:      "integer",
    orcamento_id: "integer",
    cliente:      "text",
    whatsapp:     "text",
    endereco:     "text",
    produtos:     "text",
    status:       "text",
    vendedor:     "text",
    observacoes:  "text",
    data_entrega: "text",
    criado_em:    "timestamp without time zone",
    atualizado_em:"timestamp without time zone",
  },

  // ── despesas ─────────────────────────────────────────────────────────────
  despesas: {
    id:            "integer",
    loja_id:       "integer",
    valor:         "numeric",
    categoria:     "text",
    descricao:     "text",
    comprovante:   "text",
    recorrente:    "boolean",
    recorrente_id: "integer",
    confirmada:    "boolean",
    data:          "timestamp without time zone",
    criado_em:     "timestamp without time zone",
  },

  // ── despesas_recorrentes ─────────────────────────────────────────────────
  despesas_recorrentes: {
    id:              "integer",
    loja_id:         "integer",
    valor:           "numeric",
    categoria:       "text",
    descricao:       "text",
    ativo:           "boolean",
    dia_vencimento:  "integer",
    criado_em:       "timestamp without time zone",
  },

  // ── comissoes_config ─────────────────────────────────────────────────────
  comissoes_config: {
    id:         "integer",
    loja_id:    "integer",
    vendedor:   "text",
    percentual: "numeric",
    criado_em:  "timestamp without time zone",
  },

  // ── metas ────────────────────────────────────────────────────────────────
  metas: {
    id:        "integer",
    loja_id:   "integer",
    mes:       "integer",
    ano:       "integer",
    valor:     "numeric",
    operacao:  "text",
    criado_em: "timestamp without time zone",
  },

  // ── entradas_estoque ─────────────────────────────────────────────────────
  entradas_estoque: {
    id:               "integer",
    loja_id:          "integer",
    fornecedor:       "text",
    imagem_nota:      "text",
    numero_nf:        "text",
    cnpj_fornecedor:  "text",
    total_itens:      "integer",
    criado_em:        "timestamp without time zone",
  },

  // ── itens_entrada_estoque ────────────────────────────────────────────────
  itens_entrada_estoque: {
    id:              "integer",
    entrada_id:      "integer",
    produto_id:      "integer",
    nome_extraido:   "text",
    sku_extraido:    "text",
    quantidade:      "integer",
    preco_custo:     "text",
    custo_unitario:  "numeric",
    markup_percent:  "numeric",
    preco_sugerido:  "numeric",
    criado_em:       "timestamp without time zone",
  },

  // ── colaboradores ────────────────────────────────────────────────────────
  colaboradores: {
    id:          "integer",
    loja_id:     "integer",
    codigo:      "text",
    nome:        "text",
    papel:       "text",
    tenant_id:   "text",
    operacao:    "text",
    wa:          "text",
    wa_raw:      "text",
    tom:         "text",
    header:      "text",
    assinatura:  "text",
    ativo:       "boolean",
    ultimo_acesso:"timestamp without time zone",
    criado_em:   "timestamp without time zone",
  },

  // ── follow_ups ───────────────────────────────────────────────────────────
  follow_ups: {
    id:           "integer",
    loja_id:      "integer",
    orcamento_id: "integer",
    tipo:         "text",
    mensagem:     "text",
    wa_link:      "text",
    gerado_em:    "timestamp without time zone",
    executado_em: "timestamp without time zone",
  },

  // ── usuarios ─────────────────────────────────────────────────────────────
  usuarios: {
    id:          "integer",
    loja_id:     "integer",
    nome:        "text",
    email:       "text",
    senha_hash:  "text",
    cargo:       "text",
    operacao:    "text",
    wa:          "text",
    wa_raw:      "text",
    tom:         "text",
    header:      "text",
    assinatura:  "text",
    ativo:       "boolean",
    ultimo_login:"timestamp without time zone",
    criado_em:   "timestamp without time zone",
  },

  // ── convites ─────────────────────────────────────────────────────────────
  convites: {
    id:          "integer",
    usuario_id:  "integer",
    loja_id:     "integer",
    token:       "text",
    expires_at:  "timestamp without time zone",
    usado:       "boolean",
    criado_em:   "timestamp without time zone",
  },

  // ── reset_senha_tokens ───────────────────────────────────────────────────
  reset_senha_tokens: {
    id:          "integer",
    usuario_id:  "integer",
    loja_id:     "integer",
    token:       "text",
    expires_at:  "timestamp without time zone",
    usado:       "boolean",
    criado_em:   "timestamp without time zone",
  },

  // ── audit_logs ───────────────────────────────────────────────────────────
  audit_logs: {
    id:          "integer",
    loja_id:     "integer",
    usuario_id:  "integer",
    acao:        "text",
    detalhes:    "jsonb",
    ip:          "text",
    criado_em:   "timestamp without time zone",
  },

  // ── chat_events ──────────────────────────────────────────────────────────
  chat_events: {
    id:          "integer",
    event_type:  "text",
    session_id:  "text",
    loja_id:     "integer",
    payload:     "jsonb",
    criado_em:   "timestamp without time zone",
  },

  // ── customer_profiles ────────────────────────────────────────────────────
  customer_profiles: {
    id:            "integer",
    loja_id:       "integer",
    anonymous_id:  "text",
    phone:         "text",
    name:          "text",
    criado_em:     "timestamp without time zone",
    atualizado_em: "timestamp without time zone",
  },

  // ── relational_capsules ──────────────────────────────────────────────────
  relational_capsules: {
    id:               "integer",
    customer_id:      "integer",
    loja_id:          "integer",
    capsule:          "text",
    session_count:    "integer",
    last_contact_at:  "timestamp without time zone",
    atualizado_em:    "timestamp without time zone",
  },

  // ── lead_scores ──────────────────────────────────────────────────────────
  lead_scores: {
    id:                  "integer",
    customer_id:         "integer",
    loja_id:             "integer",
    score:               "real",
    category:            "text",
    signals:             "jsonb",
    trend:               "text",
    closing_probability: "real",
    session_count:       "integer",
    total_messages:      "integer",
    last_seen_at:        "timestamp without time zone",
    first_seen_at:       "timestamp without time zone",
    atualizado_em:       "timestamp without time zone",
  },

  // ── lead_score_history ───────────────────────────────────────────────────
  lead_score_history: {
    id:            "integer",
    customer_id:   "integer",
    loja_id:       "integer",
    score:         "real",
    category:      "text",
    delta:         "real",
    trigger_event: "text",
    criado_em:     "timestamp without time zone",
  },

  // ── automation_log ───────────────────────────────────────────────────────
  automation_log: {
    id:           "integer",
    customer_id:  "integer",
    loja_id:      "integer",
    rule_id:      "text",
    score:        "real",
    category:     "text",
    channel:      "text",
    destination:  "text",
    payload:      "jsonb",
    disparado_em: "timestamp without time zone",
  },

  // ── product_families ─────────────────────────────────────────────────────
  product_families: {
    id:              "text",
    name:            "text",
    category:        "text",
    description:     "text",
    image_url:       "text",
    ranking:         "integer",
    is_active:       "boolean",
    available_sizes: "jsonb",
    semantic_tags:   "jsonb",
    created_at:      "timestamp without time zone",
    updated_at:      "timestamp without time zone",
  },

  // ── sessions ─────────────────────────────────────────────────────────────
  sessions: {
    id:          "integer",
    token:       "text",
    usuario_id:  "integer",
    loja_id:     "integer",
    payload:     "jsonb",
    expires_at:  "timestamp without time zone",
    criado_em:   "timestamp without time zone",
  },

  // ── eventos_operacionais ─────────────────────────────────────────────────
  eventos_operacionais: {
    id:              "text",
    loja_id:         "integer",
    correlation_id:  "text",
    request_id:      "text",
    entidade:        "text",
    entidade_id:     "text",
    acao:            "text",
    ator_id:         "integer",
    ator_tipo:       "text",
    payload:         "jsonb",
    criado_em:       "timestamp without time zone",
  },

  // ── whatsapp_instances ───────────────────────────────────────────────────
  whatsapp_instances: {
    id:               "integer",
    loja_id:          "integer",
    instance_id:      "text",
    provider:         "text",
    status:           "text",
    phone:            "text",
    connected_at:     "timestamp without time zone",
    last_seen_at:     "timestamp without time zone",
    session_metadata: "jsonb",
    criado_em:        "timestamp without time zone",
  },

  // ── tool_executions ──────────────────────────────────────────────────────
  tool_executions: {
    id:              "integer",
    loja_id:         "integer",
    tool_name:       "text",
    source:          "text",
    status:          "text",
    duration_ms:     "integer",
    input_summary:   "jsonb",
    error_message:   "text",
    correlation_id:  "text",
    request_id:      "text",
    criado_em:       "timestamp without time zone",
  },

  // ── lead_contexts ────────────────────────────────────────────────────────
  lead_contexts: {
    id:                   "integer",
    loja_id:              "integer",
    telefone:             "text",
    nome:                 "text",
    ultimo_interesse:     "text",
    ultima_categoria:     "text",
    ultimo_orcamento_id:  "integer",
    faixa_preco:          "text",
    tags:                 "jsonb",
    temperatura:          "text",
    ultimo_contato_em:    "timestamp without time zone",
    ultimo_resumo_ia:     "text",
    criado_em:            "timestamp without time zone",
    atualizado_em:        "timestamp without time zone",
  },

  // ── leads ────────────────────────────────────────────────────────────────
  leads: {
    id:                   "integer",
    loja_id:              "integer",
    customer_profile_id:  "integer",
    nome:                 "text",
    whatsapp:             "text",
    email:                "text",
    estagio:              "text",
    origem:               "text",
    tags:                 "jsonb",
    observacoes:          "text",
    vendedor_atribuido:   "text",
    perfil_biomecanico:   "jsonb",
    pontuacao:            "real",
    ultimo_contato:       "timestamp without time zone",
    criado_em:            "timestamp without time zone",
    atualizado_em:        "timestamp without time zone",
  },

  // ── lead_interacoes ──────────────────────────────────────────────────────
  lead_interacoes: {
    id:          "integer",
    lead_id:     "integer",
    loja_id:     "integer",
    tipo:        "text",
    conteudo:    "text",
    autor_id:    "text",
    autor_nome:  "text",
    criado_em:   "timestamp without time zone",
  },

  // ── lead_tarefas ─────────────────────────────────────────────────────────
  lead_tarefas: {
    id:           "integer",
    lead_id:      "integer",
    loja_id:      "integer",
    descricao:    "text",
    tipo:         "text",
    prazo:        "timestamp without time zone",
    concluso:     "boolean",
    responsavel:  "text",
    criado_em:    "timestamp without time zone",
  },

  // ── conversas_whatsapp ───────────────────────────────────────────────────
  conversas_whatsapp: {
    id:                "integer",
    loja_id:           "integer",
    phone:             "text",
    nome:              "text",
    lead_id:           "integer",
    status:            "text",
    atendente:         "text",
    ultima_mensagem_em:"timestamp without time zone",
    criado_em:         "timestamp without time zone",
  },

  // ── mensagens_whatsapp ───────────────────────────────────────────────────
  mensagens_whatsapp: {
    id:               "integer",
    loja_id:          "integer",
    conversa_id:      "integer",
    from:             "text",
    to:               "text",
    body:             "text",
    tipo:             "text",
    media_url:        "text",
    direcao:          "text",
    status:           "text",
    atendente:        "text",
    lida:             "boolean",
    waha_message_id:  "text",
    criado_em:        "timestamp without time zone",
  },

  // ── ai_usage ─────────────────────────────────────────────────────────────
  ai_usage: {
    id:              "bigint",
    loja_id:         "integer",
    modelo:          "text",
    input_tokens:    "integer",
    output_tokens:   "integer",
    cache_tokens:    "integer",
    custo_estimado:  "numeric",
    contexto:        "text",
    request_id:      "text",
    criado_em:       "timestamp without time zone",
  },

  // ── scheduler_locks ──────────────────────────────────────────────────────
  scheduler_locks: {
    id:            "integer",
    scheduler_id:  "text",
    locked_at:     "timestamp without time zone",
    locked_by:     "text",
    expires_at:    "timestamp without time zone",
    last_run_at:   "timestamp without time zone",
    last_run_ok:   "boolean",
  },

  // ── diagnosticos ─────────────────────────────────────────────────────────
  diagnosticos: {
    id:                    "integer",
    loja_id:               "integer",
    customer_id:           "integer",
    nome:                  "text",
    whatsapp:              "text",
    produto_recomendado:   "text",
    confianca:             "numeric",
    flag_calibracao:       "text",
    respostas:             "jsonb",
    perfil_biomecanico:    "jsonb",
    perfil_comportamental: "jsonb",
    criado_em:             "timestamp without time zone",
  },

  // ── sleep_outcomes ───────────────────────────────────────────────────────
  sleep_outcomes: {
    id:                  "integer",
    diagnostico_id:      "integer",
    customer_id:         "integer",
    loja_id:             "integer",
    vendeu:              "boolean",
    produto_vendido:     "text",
    ticket:              "numeric",
    registrado_em:       "timestamp without time zone",
    satisfacao_30d:      "integer",
    satisfacao_90d:      "integer",
    dor_melhorou:        "boolean",
    satisfacao_180d:     "integer",
    satisfacao_365d:     "integer",
    indicou:             "boolean",
    nps:                 "integer",
    trocou:              "boolean",
    motivo_troca:        "text",
    sleep_success_score: "numeric",
    criado_em:           "timestamp without time zone",
    atualizado_em:       "timestamp without time zone",
  },

  // ── sales_opportunities ──────────────────────────────────────────────────
  sales_opportunities: {
    id:                  "integer",
    loja_id:             "integer",
    orcamento_id:        "integer",
    customer_id:         "integer",
    lead_id:             "integer",
    diagnostico_id:      "integer",
    cliente:             "text",
    whatsapp:            "text",
    status:              "text",
    score:               "real",
    closing_probability: "real",
    valor_numerico:      "real",
    valor_brl:           "text",
    dias_sem_resposta:   "integer",
    proxima_acao:        "text",
    motivo:              "text",
    responsavel:         "text",
    ultimo_contato_em:   "timestamp without time zone",
    proximo_contato_em:  "timestamp without time zone",
    criado_em:           "timestamp without time zone",
    atualizado_em:       "timestamp without time zone",
  },
};

// ─── 3. Reconcile de colunas ─────────────────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error("[reconcile] DATABASE_URL não definida");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let colunasAdicionadas = 0;
let colunasFalhas = 0;

try {
  // Busca todas as colunas existentes de uma vez (mais eficiente que N queries)
  const tableNames = Object.keys(SCHEMA);
  const { rows: existingCols } = await client.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [tableNames],
  );

  // Monta set de colunas existentes: "tabela.coluna"
  const existingSet = new Set(
    existingCols.map((r) => `${r.table_name}.${r.column_name}`),
  );

  // Gera ALTERs para colunas ausentes
  const alters = [];
  for (const [table, cols] of Object.entries(SCHEMA)) {
    for (const [col, pgType] of Object.entries(cols)) {
      const key = `${table}.${col}`;
      if (!existingSet.has(key)) {
        alters.push({ table, col, pgType });
      }
    }
  }

  if (alters.length === 0) {
    console.log("[reconcile] nenhuma coluna ausente detectada");
  } else {
    console.log(`[reconcile] ${alters.length} coluna(s) ausente(s) — aplicando ALTERs...`);
    for (const { table, col, pgType } of alters) {
      const sql = `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" ${pgType}`;
      try {
        await client.query(sql);
        console.log(`[reconcile]   ✓ ${table}.${col} (${pgType})`);
        colunasAdicionadas++;
      } catch (err) {
        console.error(`[reconcile]   ✗ ${table}.${col}: ${err.message}`);
        colunasFalhas++;
      }
    }
  }
} finally {
  await client.end();
}

// ─── 4. Resumo ───────────────────────────────────────────────────────────────

const totalSchema = Object.values(SCHEMA).reduce((s, cols) => s + Object.keys(cols).length, 0);
const jaExistiam  = totalSchema - colunasAdicionadas - colunasFalhas;

console.log(
  `[reconcile] concluído — colunas_schema=${totalSchema} já_existiam=${jaExistiam} colunas_adicionadas=${colunasAdicionadas} falhas=${colunasFalhas}`,
);

if (colunasFalhas > 0) {
  process.exit(1);
}
