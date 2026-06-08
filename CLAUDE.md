# CLAUDE.md
<!-- updated: 2026-06-08 -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Run frontend (React + Vite)
pnpm --filter @workspace/castor-orcamento run dev

# Run backend (Express API)
pnpm --filter @workspace/api-server run dev
```

### Build & Type Check
```bash
# Type check entire monorepo (composite project references)
pnpm run typecheck

# Build everything
pnpm run build

# Lint / lint with fixes
pnpm run lint
pnpm run lint:fix

# Build a specific package
pnpm --filter @workspace/castor-orcamento run build
pnpm --filter @workspace/api-server run build
```

### Database
```bash
# Push schema changes to PostgreSQL (interactive)
pnpm --filter @workspace/db run push

# Force push (destructive — drops/recreates columns)
pnpm --filter @workspace/db run push-force

# Generate SQL reconciliation file (push:generate)
pnpm --filter @workspace/db run push:generate
```

### API Code Generation
```bash
# Regenerate React Query hooks + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

There is no test framework configured in this project.

---

## Architecture

### Monorepo Structure
- `artifacts/` — Deployable applications (frontend, API server)
- `lib/` — Shared internal packages (db, API spec, AI integrations, generated client)
- `scripts/` — Utility scripts
- `pnpm-workspace.yaml` — Workspace config with version catalog (pnpm 10.13.1)

### Key Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/castor-orcamento` | `artifacts/castor-orcamento/` | React 19 + Vite SPA (frontend) |
| `@workspace/api-server` | `artifacts/api-server/` | Express 5 REST API |
| `@workspace/db` | `lib/db/` | Drizzle ORM + PostgreSQL schema (28 tables) |
| `@workspace/api-spec` | `lib/api-spec/` | OpenAPI spec + Orval codegen config |
| `@workspace/api-client-react` | `lib/api-client-react/` | Generated React Query hooks (from Orval) |
| `@workspace/api-zod` | `lib/api-zod/` | Generated Zod schemas (from Orval) |
| `@workspace/integrations-openai-ai-server` | `lib/integrations-openai-ai-server/` | OpenAI chat + image + audio client |
| `@workspace/integrations-gemini-ai` | `lib/integrations-gemini-ai/` | Gemini Vision client (NF-e OCR) |

### Data Flow
The API contract lives in `lib/api-spec/`. Running Orval codegen regenerates the React Query hooks in `lib/api-client-react/` and Zod schemas in `lib/api-zod/`. The frontend imports these generated hooks — avoid hand-writing `fetch` calls for API routes that are in the spec.

---

## Database Layer (`lib/db/`)
- Drizzle ORM with `pg` driver (connection pool via `DATABASE_URL`)
- Schemas in `lib/db/src/schema/` — one file per domain
- `drizzle-zod` auto-generates Zod insert/select schemas from table definitions
- No migrations folder — Drizzle Kit manages schema via `push` commands

### Full Schema (28 Tables)

**Multi-tenancy & Auth:**
| Table | Key Columns | Notes |
|---|---|---|
| `lojas` | id, slug, nome, operacao, configJson | Tenant master; `configJson` holds feature flags |
| `usuarios` | id, nome, email, cargo, lojaId, papel, wa, waRaw, tom, header, assinatura | RBAC users |
| `colaboradores` | codigo, papel, wa, waRaw, ton, header, assinatura | Legacy staff — being migrated to `usuarios` |
| `sessions` | token (unique), usuarioId, lojaId, payload, expiresAt | Auth sessions |
| `convites` | usuarioId, lojaId, token, expiresAt, usado | User invitation tokens |
| `reset_senha_tokens` | usuarioId, lojaId, token, expiresAt, usado | Password reset flow |
| `audit_logs` | lojaId, usuarioId, acao, detalhes, ip | User audit trail |

**Products & Catalog:**
| Table | Key Columns | Notes |
|---|---|---|
| `produtos` | id, nome, sku, slug, preco, precoPix, precoBase, categoria, estoque, salesMode, deliveryStrategy, sincronizadoEm | Composite unique (sku, lojaId) and (slug, lojaId) |
| `product_families` | id (slug), name, category, availableSizes, semanticTags | Canonical family; semanticTags = biomechanical attributes (pressure_relief, lumbar_support…) |
| `crawler_status` | status, mensagem, totalProdutos, erros, iniciadoEm, finalizadoEm | Playwright scraper job state |

**Sales & Quotes:**
| Table | Key Columns | Notes |
|---|---|---|
| `orcamentos` | id, cliente, whatsapp, produtosJson, status, vendidoEm | `vendidoEm` = financial closing date for DRE |
| `entregas` | id, orcamentoId, cliente, whatsapp, status, dataEntrega | Logistics state |
| `follow_ups` | lojaId, orcamentoId, tipo, mensagem, executadoEm | Cadence types: FOLLOWUP_D2/D5/D10/REATIVACAO_D30/RECUPERACAO_D60 |

**Inventory:**
| Table | Key Columns | Notes |
|---|---|---|
| `entradas_estoque` | fornecedor, numeroNF, imagemNota | Invoice header |
| `itens_entrada_estoque` | entradaId, produtoId, quantidade, precoCusto, markupPercent, precoSugerido | Invoice line items |
| `outlet_interesses` | — | User interest tracking for clearance products |

**Financial:**
| Table | Key Columns | Notes |
|---|---|---|
| `despesas` | lojaId, valor, categoria, descricao, recorrente, confirmada, data | Expenses |
| `despesas_recorrentes` | lojaId, valor, categoria, diaVencimento | Recurring expense templates |
| `comissoes_config` | lojaId, vendedor, percentual | Per-seller commission rates |
| `metas` | lojaId, mes, ano, valor, operacao | Monthly sales targets |

**CRM & Customer Intelligence:**
| Table | Key Columns | Notes |
|---|---|---|
| `customer_profiles` | lojaId, anonymousId, phone, name | Identity resolution anchor |
| `relational_capsules` | customerId, capsule (text), sessionCount, lastContactAt | Persistent AI memory |
| `lead_scores` | lojaId, customerId, score (0–100), category (frio/morno/quente/critico), signals (jsonb), closingProbability, sessionCount, trend | Scoring engine output |
| `lead_score_history` | customerId, lojaId, score, delta, triggerEvent | Score audit trail |
| `leads` | id, lojaId, customerProfileId, nome, whatsapp, estagio, origem, tags, perfilBiomecanico, pontuacao, ultimoContato | Lead CRM record |
| `lead_interacoes` | leadId, tipo (mensagem_wa/ligacao/orcamento/visita/nota/email/handoff), conteudo | Interaction log |
| `lead_tarefas` | leadId, descricao, prazo, concluso, responsavel | Task tracking |
| `lead_contexts` | lojaId, telefone, nome, ultimoInteresse, faixaPreco, tags, temperatura, ultimoResumoIA | Enriched context |

**Operations (COCA):**
| Table | Key Columns | Notes |
|---|---|---|
| `sales_opportunities` | lojaId, orcamentoId, customerId, leadId, diagnosticoId, cliente, whatsapp, status, score, closingProbability, valorNumerico, diasSemResposta, proximaAcao | Unified COCA aggregate |
| `eventos_operacionais` | id (uuid), lojaId, correlationId, entidade, entidadeId, acao (created/updated/deleted/viewed/exported), atorId, atorTipo, payload | Audit log for all entity changes |

**Sleep Science:**
| Table | Key Columns | Notes |
|---|---|---|
| `diagnosticos` | lojaId, customerId, nome, whatsapp, respostas (jsonb), perfil_biomecanico, perfil_comportamental | Quiz results |
| `sleep_outcomes` | diagnosticoId, customerId, vendeu, satisfacao_30d/90d/180d/365d, dor_melhorou, nps, trocou, sleep_success_score | Post-sale follow-up |

**WhatsApp & Messaging:**
| Table | Key Columns | Notes |
|---|---|---|
| `mensagens_whatsapp` | lojaId, conversaId, from, to, body, tipo, direcao (inbound/outbound), status, lida, wahaMessageId | `wahaMessageId` for dedup |
| `conversas_whatsapp` | lojaId, phone, nome, leadId, status (bot/aguardando_humano/humano/resolvido), atendente | Conversation state |
| `whatsapp_instances` | lojaId, instanceId, provider (evolution/waha), status, phone, connectedAt, sessionMetadata | Instance connections |

**AI & Observability:**
| Table | Key Columns | Notes |
|---|---|---|
| `chat_events` | eventType, sessionId, lojaId, payload | Chat session event log |
| `ai_usage` | lojaId, modelo, inputTokens, outputTokens, cacheTokens, custoEstimado, contexto (chat/waha/capsule/lead) | Token cost tracking |
| `tool_executions` | lojaId, toolName, source (chat/mcp), status, durationMs, inputSummary, errorMessage, correlationId | MCP/tool audit |
| `automation_log` | customerId, lojaId, ruleId, score, category, channel, destination, payload | Hot-lead automation audit |
| `scheduler_locks` | lojaId, lockId, expiresAt | Distributed lock for setInterval cron jobs |

---

## Backend (`artifacts/api-server/`)
- Express 5, entry `src/index.ts` → `src/app.ts`
- Routes mounted at `/api`, organized in `src/routes/`
- Auth: `requireAuth` middleware in `src/middlewares/auth.ts`; sensitive endpoints check `x-session-token` header

### API Routes (28 Router Modules)

**Auth & Users:**
- `POST /api/auth/login` — Email+senha or legacy code login → token + session
- `GET  /api/auth/me` — Session validation + feature flags (from `lojas.configJson`)
- `POST /api/auth/logout` — Destroy session
- `/api/usuarios` — User CRUD, password reset, invitations

**Products & Catalog:**
- `/api/produtos` — Catalog search, CRUD, photo extraction
- `/api/catalog` — MCP-exposed catalog tools (search_products, get_catalog, get_product_family, get_store_info)
- `/api/crawler` — Playwright scraper trigger & status

**Quotes & Sales:**
- `/api/orcamento` — Quote generation, listing, status updates
- `/api/leads` — Lead CRUD, interaction logging, task management
- `/api/entrada-estoque` — Invoice entry with Gemini Vision photo→SKU extraction

**Operations & Logistics:**
- `/api/operacoes` — COCA dashboard with `sales_opportunities` aggregate
- `/api/entregas` — Delivery routing, status, driver assignment
- `/api/historico` — Historical quote analytics

**Financial:**
- `/api/financeiro` — DRE, expenses, commissions, targets, margin analysis

**AI & Chat:**
- `POST /api/chat` — ThallesZzz AI chat (Claude Sonnet 4.6, SSE streaming, 2-pass)
- `POST /api/agent/run` — Managed Agent API (JSON response)
- `POST /api/agent/stream` — Managed Agent SSE streaming
- `GET/POST/DELETE /api/mcp` — Stateless MCP server endpoint

**Messaging & Real-time:**
- `/api/inbox` — Conversation listing + SSE stream for real-time inbox updates
- `/api/whatsapp` — Instance QR, connection status, webhook (Evolution + WAHA)
- `/api/waha` — WAHA-specific webhook & session cleanup

**Analytics & Diagnostics:**
- `/api/diagnostico` — Sleep science quiz + biomechanical analysis
- `/api/outcomes` — Post-sale follow-up results
- `/api/dashboard` — Key metrics, conversions, revenue
- `/api/analytics` — Event-based analytics
- `/api/scoring` — Lead score updates + signal computation

**Utility:**
- `/api/health`, `/healthz/deep` — Server health check
- `/api/loja` — Store info
- `/api/sitemap` — Dynamic sitemap for SEO
- `/api/twin` — Digital Twin (customer memory)

### Backend Services (`src/services/`)

**AI & Memory:**
- `services/chat/` — ThallesZzz agent (Claude Sonnet 4.6); `prompt.ts`, `lead-extractor.ts`, `repository.ts`
- `services/memory/identity.ts` — `resolveOrCreateCustomer()`, `stitchIdentityByPhone()`
- `services/memory/capsule.ts` — `loadCapsule()`, `buildStateBlock()`, `generateAndSaveCapsule()`

**Lead Scoring Engine (`services/scoring/`):**
- `signals.ts` — Signal extraction (recency, session count, abandonment, engagement)
- `rules.ts` / `weights.ts` — Scoring rules + weights
- `engine.ts` — Score calculation (0–100)
- `automations.ts` — Hot-lead alerts & handoff rules
- `updater.ts` — Async score update scheduler

**Business Domains:**
- `services/catalog/` — Product family mapping, search, pricing
- `services/orcamento.ts` — Quote generation, hierarchical pricing (base → pix → outlet markup)
- `services/operacoes/` — Sales opportunity aggregation for COCA
- `services/finance/` — DRE calculation
- `services/usuarios/` — User CRUD, auth token, audit
- `services/whatsapp/` — Evolution API + WAHA adapters
- `services/lead-context.ts` — Lead context enrichment (interest, category, price range, temperature)
- `services/events/emit.ts` + `classifier.ts` — Operational event emission & intent classification

**Infrastructure:**
- `lib/sessions.ts` — In-memory session store + DB persistence; hydrated on boot via `hydrateSessionsFromDB()`
- `lib/rbac.ts` — Role definitions (ADMIN, GERENTE, VENDEDOR, FINANCEIRO, ENTREGA)
- `lib/logger.ts` — Pino structured logger (requestId, correlationId)
- `lib/ai-usage.ts` — Anthropic token + cost tracking
- `lib/recorrentes-scheduler.ts` — Monthly recurring expense generation (setInterval)
- `lib/followup-scheduler.ts` — Follow-up cadence dispatch (D2/D5/D10/D30/D60)
- `lib/tools/definitions.ts` — Tool schema definitions
- `lib/tool-runner.ts` — Tool call execution with context injection
- `lib/mcp/server.ts` — MCP server factory
- `lib/castor-agent.ts` — Managed Agent beta API (createCastorSession, sendCastorMessage, streamCastorEvents)

---

## Frontend (`artifacts/castor-orcamento/`)
- React 19 + Vite + Tailwind CSS 4 (Vite plugin, no `tailwind.config.ts`)
- Routing via **wouter** (not React Router, not Next.js)
- Auth state in `sessionStorage` + React Context (`AuthContext.tsx`)
- Data fetching: React Query (TanStack) with 5-min stale time, 1 retry, no refetch on window focus
- UI: Radix UI primitives + shadcn/ui (CVA + clsx) + Framer Motion

### Contexts
- `AuthContext` — User auth state, token, role
- `LojaContext` — Active store info
- `ThemeContext` — Light/dark theme

### Route Structure

**Public (no auth):**
- `/` — Landing page (redirects authenticated users to `/operacoes`)
- `/catalogo` — Product catalog
- `/mapa-sono` — Sleep assessment tool
- `/produto/:slug` — Product detail
- `/lp/*` — Campaign landing pages (luxo, box-bau, outlet, saude-coluna, entrega-24h)
- `/aceitar-convite` — Accept invitation
- `/redefinir-senha` — Password reset

**Private (`PrivateRoute` — any authenticated user):**
- `/equipe` — Team home
- `/orcamento` — Quote builder & manager
- `/historico` — Quote history
- `/operacoes` — **COCA / Central de Operações (default post-login dashboard)**
- `/dashboard` — Analytics dashboard
- `/logistica` — Delivery management
- `/crawler` — Scraper status
- `/equipe/clientes` — CRM lead list
- `/equipe/clientes/:id` — Customer detail
- `/inbox` — WhatsApp inbox + real-time messages
- `/outlet` — Clearance product list
- `/financeiro` — Financial statements & KPIs

**Admin-Only (`DonoRoute` — papel: dono | ADMIN | GERENTE):**
- `/estoque` — Inventory management
- `/ranking-outlet` — Outlet performance metrics
- `/entrada-estoque` — Stock entry photo scanner (NF-e parsing)
- `/usuarios` — User administration
- `/diagnosticos` — Sleep outcomes review

---

## Authentication Flow

1. `POST /api/auth/login` with `{email, senha}` (or legacy `{code}`)
2. Backend validates → `createSessionByEmail()` → returns `{token, user}`
3. `user` includes: `nome, cargo, papel, operacao, lojaId, wa, waRaw, tom, header, assinatura, features`
4. Frontend stores token in `sessionStorage` + `AuthContext`
5. All subsequent requests include `x-session-token: <token>` header

**Feature flags** are resolved from `lojas.configJson` (cached 5 min), returned in `/api/auth/me`:
- `crm`, `inbox`, `aiMemory`, `hotLeadAlerts`, `multiAttendant`

**RBAC roles:** `ADMIN` > `GERENTE` > `VENDEDOR` | `FINANCEIRO` | `ENTREGA` (legacy aliases: `dono`, `vendedor`, `entrega`)

---

## AI Stack

### Current Configuration (do not change without reason)
- **ThallesZzz Chat:** `claude-sonnet-4-6`, 2-pass streaming, tool budget MAX 2/turn
  - Cache: `ephemeral` on SYSTEM_PROMPT (upgrade to `persistent` when Anthropic SDK supports it)
  - Cost tracking: `ai_usage` table + `event=session_complete` Pino log line
- **Structured extraction:** `claude-haiku-4-5-20251001`, skipped for `intent=low`
- **Managed Agent:** beta API sessions (`CASTOR_AGENT_ID`, `CASTOR_ENVIRONMENT_ID`)
- **Gemini Vision:** NF-e invoice photo → SKU/quantity extraction (entrada-estoque)
- **OpenAI:** Fallback for some integrations

### MCP Server
- Stateless endpoint at `/api/mcp` (GET, POST, DELETE)
- Context injected server-side: `lojaId`, `actorId`, `actorType`, `vendedor`
- Available tools: `search_products`, `get_catalog`, `get_product_family`, `get_store_info`, `create_orcamento`

---

## Environment Variables

### Hard-Required
| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port (3000 in production) |

### AI & Chat
| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `CASTOR_AGENT_ID` | Managed Agent ID (default: `agent_011CaUZvcdTX3LxfnopZE9Cw`) |
| `CASTOR_ENVIRONMENT_ID` | Managed Agent env (default: `env_0111U769QLZaYYpabKFRacWM`) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL (https://api.openai.com/v1) |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Gemini Vision key |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Gemini base URL |
| `OPENAI_API_KEY` | Direct OpenAI usage |

### WhatsApp
| Variable | Notes |
|---|---|
| `EVOLUTION_API_URL` | Evolution API base URL (primary provider) |
| `EVOLUTION_API_KEY` | Evolution auth token |
| `EVOLUTION_WEBHOOK_TOKEN` | Webhook signature validation |
| `WAHA_URL` | WAHA API base URL (fallback) |
| `WAHA_WEBHOOK_SECRET` | WAHA webhook auth |
| `WAHA_SESSION_NAME` | Session name (default: `castor`) |
| `WHATSAPP_PROVIDER` | Provider selector (default: `evolution`) |

### Infrastructure
| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` or `development` |
| `DATABASE_PROVIDER` | `postgresql` |
| `LOG_LEVEL` | Pino level (`trace`/`debug`/`info`/`warn`/`error`) |
| `ALLOWED_ORIGINS` | CORS allowlist (comma-separated URLs) |

### Frontend (Vite build-time)
| Variable | Notes |
|---|---|
| `VITE_GTM_ID` | Google Tag Manager ID |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 ID |
| `VITE_GOOGLE_ADS_ID` | Google Ads conversion ID |
| `VITE_GOOGLE_ADS_CONVERSION_WHATSAPP` | WhatsApp conversion label |
| `VITE_API_URL` | Backend URL (must point to Railway) |
| `BASE_PATH` | Router base path (default: `/`) |
| `SITE_URL` | Public site URL |

---

## Estado do Projeto — Fase Atual (Jun/2026)

**Contexto operacional:**
- Não existem clientes reais cadastrados ainda.
- O site principal ainda não foi lançado publicamente.
- Não existem diagnósticos reais em produção.
- Não existem vendas originadas pelo sistema.
- Não existem outcomes reais coletados.
- Não existem métricas suficientes para calibração de algoritmos.

**Conclusão:** O sistema está em fase de construção da fundação de inteligência, não em fase de otimização.

**Prioridades desta fase:**
- Coleta de dados estruturada
- Persistência e rastreabilidade
- Integração entre módulos existentes
- Isolamento multi-tenant
- Qualidade dos dados coletados

**O que evitar:**
- Overengineering e novas infraestruturas complexas
- Entidades ou tabelas duplicadas
- Arquiteturas paralelas ao que já existe
- Algoritmos dependentes de volume de dados inexistente

**Digital Twin — fundações existentes (não duplicar):**
- `customer_profiles` + `relational_capsules` + `lead_scores` + `lead_score_history`
- `resolveOrCreateCustomer()` + `stitchIdentityByPhone()` em `services/memory/identity.ts`
- `diagnosticos` + `sleep_outcomes` conectados via `customerId` FK

**Visão alvo (ciclo completo):**
```
Lead → Diagnóstico → Compatibilidade → Recomendação → Venda → Resultado → Aprendizado → Recalibração
```

**Princípio central: dados antes de algoritmos.**

Antes de criar nova tabela ou agregado: verificar se o problema é ausência de integração ou ausência real de modelagem.

---

## Domain Context
Castor-SaaS is a SaaS platform for a mattress store chain. Key business features:
- **COCA (Central de Operações)** — primary ops dashboard, unified sales opportunity pipeline (orcamento + lead + diagnostico + customer)
- **Orçamento** — quote generation with WhatsApp-native delivery (pre-filled wa.me links)
- **Estoque** — inventory management; `salesMode` enum (showroom/outlet/hidden/seasonal), `deliveryStrategy` (pronta_entrega/sob_encomenda)
- **Financeiro** — expenses, commissions, DRE (income statement), goals
- **Logística** — delivery routing with Google Maps integration
- **CRM (Clientes)** — lead management, interaction history, scoring, task tracking
- **Inbox** — WhatsApp multi-attendant inbox with real-time SSE updates
- **Crawler** — headless Playwright scraper to auto-update product catalog from supplier site
- **Chat (ThallesZzz)** — AI sales assistant on public pages, SSE streaming, Claude Sonnet 4.6
- **Diagnóstico** — sleep science quiz → biomechanical profile → product recommendation
- **Outcomes** — 30/90/180/365-day post-sale follow-ups for Sleep Success Score

---

## Architectural Principles

### Decision criteria (in priority order)
1. Preserve data integrity — multi-tenant isolation is non-negotiable
2. Preserve operational visibility — if it's not observable, don't ship it
3. Preserve healthy unit cost — AI cost per session must be measurable
4. Avoid premature complexity — no abstraction without concrete evidence of need
5. Expand only on clear signal — logs showing real bottlenecks, not hypothetical ones

### When in doubt between two approaches, prefer the one that:
- Keeps the system observable (structured Pino logs, `/healthz/deep`)
- Reduces risk of silent data corruption (lojaId filters, composite uniques)
- Conserves operational simplicity (monolith is correct at current scale)
- Improves margin without unnecessary coupling

### Before any schema change (constraints, unique keys, multi-tenant behavior)
**MANDATORY:** Run validation queries against Railway Postgres before applying `db push`:
```sql
-- Example for composite unique migrations:
SELECT <key_col>, loja_id, COUNT(*) FROM <table>
GROUP BY <key_col>, loja_id HAVING COUNT(*) > 1;
```
If duplicates exist → clean data first, then push. Never push a constraint onto dirty data.

### What does NOT belong in this codebase at current scale
- RAG / pgvector / semantic search (no evidence of retrieval failure rate > 20%)
- BullMQ / Redis (schedulers are correct with setInterval up to ~50 tenants)
- Microservices / multi-region (monolith is correct architecture today)
- LangChain / orchestration frameworks (direct Anthropic SDK is simpler and cheaper)
- Sentry / Datadog (defer until Railway logs prove insufficient)

---

## Deploy — Railway (Production)

### REGRA ABSOLUTA — PROJETO UNICO (CFO RULE)

**PROIBICOES IMUTAVEIS — qualquer violacao e erro critico de execucao:**
- NUNCA criar novo projeto Railway
- NUNCA criar novo ambiente Railway
- NUNCA duplicar servicos (backend, banco, frontend)
- NUNCA iniciar infraestrutura fora do projeto `diligent-endurance`

**ANTES de qualquer criacao de servico:**
1. Verificar se ja existe no projeto `diligent-endurance`
2. Se existir → reutilizar obrigatoriamente
3. Se nao existir → criar DENTRO de `diligent-endurance` apenas

**Deploy automatico:** APENAS via branch `main`. Feature branches nao fazem deploy no Railway.

### Servicos no projeto diligent-endurance
| Service | Tipo | URL |
|---|---|---|
| Postgres | Railway Postgres | (internal) |
| evolution-api | api-server Castor | https://evolution-api-production-405f.up.railway.app |
| eloquent-laughter | Evolution API v2.2.3 | https://eloquent-laughter-production-a0b7.up.railway.app |

### Env vars configuradas no api-server (Railway)
- `DATABASE_URL` — auto Railway Postgres
- `DATABASE_PROVIDER=postgresql`
- `PORT=3000`
- `NODE_ENV=production`
- `ANTHROPIC_API_KEY` — inserir manualmente
- `AI_INTEGRATIONS_GEMINI_BASE_URL=https://api.openai.com/v1`
- `AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1`
- `CASTOR_AGENT_ID=agent_011CaUZvcdTX3LxfnopZE9Cw`
- `CASTOR_ENVIRONMENT_ID=env_0111U769QLZaYYpabKFRacWM`

Faltam (adicionar via +New Variable no Railway):
- `OPENAI_API_KEY`
- `AI_INTEGRATIONS_GEMINI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_API_KEY`

### Configuracoes criticas do service
- Pre-deploy: `pnpm --filter @workspace/db run push`
- Start: `pnpm --filter @workspace/api-server start`
- Public port: 3000 (nao 8080)

### Frontend Vercel
- castor-saa-s-castor-orcamento.vercel.app
- `VITE_API_URL` deve apontar ao backend Railway
- `/api/*` requests proxied to Railway via Vercel config

### Seguranca
- Rotacionar `ANTHROPIC_API_KEY` em console.anthropic.com
- Nunca usar Raw Editor Railway com chaves sensiveis
- WhatsApp: links wa.me manuais — sem envio automatico implementado
