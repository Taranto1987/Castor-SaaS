# CLAUDE.md
<!-- deploy: 2026-05-20 -->

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

# Build a specific package
pnpm --filter @workspace/castor-orcamento run build
pnpm --filter @workspace/api-server run build
```

### Database
```bash
# Push schema changes to PostgreSQL
pnpm --filter @workspace/db run push

# Force push (destructive — drops/recreates columns)
pnpm --filter @workspace/db run push-force
```

There is no test framework configured in this project.

## Architecture

### Monorepo Structure
- `artifacts/` — Deployable applications (frontend, API server)
- `lib/` — Shared internal packages (db, API spec, AI integrations, generated client)
- `scripts/` — Utility scripts

### Key Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/castor-orcamento` | `artifacts/castor-orcamento/` | React + Vite SPA (frontend) |
| `@workspace/api-server` | `artifacts/api-server/` | Express 5 REST API |
| `@workspace/db` | `lib/db/` | Drizzle ORM + PostgreSQL schema |
| `@workspace/api-spec` | `lib/api-spec/` | OpenAPI spec + Orval codegen config |
| `@workspace/api-client-react` | `lib/api-client-react/` | Generated React Query hooks (from Orval) |
| `@workspace/api-zod` | `lib/api-zod/` | Generated Zod schemas (from Orval) |

### Data Flow
The API contract lives in `lib/api-spec/`. Running Orval codegen regenerates the React Query hooks in `lib/api-client-react/` and Zod schemas in `lib/api-zod/`. The frontend imports these generated hooks — avoid hand-writing `fetch` calls for API routes that are in the spec.

### Database Layer (`lib/db/`)
- Drizzle ORM with `pg` driver (connection pool via `DATABASE_URL`)
- Schemas in `lib/db/src/schema/` — one file per domain (products, orcamentos, entregas, despesas, etc.)
- `drizzle-zod` auto-generates Zod insert/select schemas from table definitions
- No migrations folder — Drizzle Kit manages schema via `push` commands

### Backend (`artifacts/api-server/`)
- Express 5, entry `src/index.ts` → `src/app.ts`
- Routes mounted at `/api`, organized in `src/routes/` (auth, produtos, orcamento, crawler, entregas, dashboard, financeiro, chat, entrada-estoque)
- Auth: `POST /api/auth/login` returns a JWT; sensitive endpoints check `x-session-token` header directly in route handlers (no global auth middleware)
- AI: OpenAI (`gpt-4o-mini` for chat/SSE streaming) and Gemini Vision (invoice photo → stock entry extraction)

### Frontend (`artifacts/castor-orcamento/`)
- React 19 + Vite + Tailwind CSS 4 (Vite plugin, no `tailwind.config.ts`)
- Routing via **wouter** — public (`/`, `/catalogo`, `/mapa-sono`) and private routes guarded by `PrivateRoute` / `DonoRoute` (role: `dono` vs `vendedor`/`entrega`)
- Auth state stored in `sessionStorage` + React Context (`AuthContext.tsx`)
- Data fetching: React Query (TanStack) with 5-min stale time, 1 retry, no refetch on window focus
- UI: Radix UI primitives + shadcn/ui component pattern (CVA + clsx), Framer Motion for animations

### Environment Variables
| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | Yes | Used by both API and frontend servers |
| `BASE_PATH` | Frontend | Base path for Vite router |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | For AI chat | OpenAI key |
| `VITE_GTM_ID` | Optional | Google Tag Manager (injected at build) |
| `VITE_GA_MEASUREMENT_ID` | Optional | Google Analytics 4 |

## Domain Context
Castor-SaaS is a SaaS platform for a mattress store chain. Key business features:
- **Orçamento** — quote generation with WhatsApp-native delivery (pre-filled WA message links)
- **Estoque** — inventory management, distinguishes in-stock vs outlet/encomenda products
- **Financeiro** — expenses, commissions, DRE (income statement), goals
- **Logística** — delivery routing with Google Maps integration
- **Clientes** — CRM aggregated by phone/name with conversion tracking
- **Crawler** — headless Playwright scraper to auto-update the product catalog from the supplier website
- **Chat (ThallesZzz)** — AI sales assistant on public pages, SSE streaming

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

### Current AI stack (do not change without reason)
- Chat: `claude-sonnet-4-6`, 2-pass streaming, tool budget MAX 2/turn
- Structured extraction: `claude-haiku-4-5-20251001`, skipped for `intent=low`
- Cache: `ephemeral` on SYSTEM_PROMPT only (upgrade to `persistent` when SDK supports it)
- Cost tracking: `event=session_complete` log line per session

---

## Deploy — Railway (Production) — 30/04/2026

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

---

### Servicos no projeto diligent-endurance
| Service | Tipo | URL |
|---|---|---|
| Postgres | Railway Postgres | (internal) |
| evolution-api | api-server Castor | https://evolution-api-production-405f.up.railway.app |
| eloquent-laughter | Evolution API v2.2.3 | https://eloquent-laughter-production-a0b7.up.railway.app |

### Env vars configuradas no api-server (Railway)
- DATABASE_URL — auto Railway Postgres
- DATABASE_PROVIDER=postgresql
- PORT=3000
- NODE_ENV=production
- ANTHROPIC_API_KEY — inserir manualmente
- AI_INTEGRATIONS_GEMINI_BASE_URL=https://api.openai.com/v1
- AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
- CASTOR_AGENT_ID=agent_011CaUZvcdTX3LxfnopZE9Cw
- CASTOR_ENVIRONMENT_ID=env_0111U769QLZaYYpabKFRacWM

Faltam (adicionar via +New Variable no Railway):
- OPENAI_API_KEY
- AI_INTEGRATIONS_GEMINI_API_KEY
- AI_INTEGRATIONS_OPENAI_API_KEY

ZAPI_TOKEN: sem implementacao no codigo — nao necessario.

### Configuracoes criticas do service
- Pre-deploy: pnpm --filter @workspace/db run push
- Start: pnpm --filter @workspace/api-server start
- Public port: 3000 (nao 8080)

### WhatsApp
Links wa.me manuais. Sem envio automatico implementado.

### Frontend Vercel
- castor-saa-s-castor-orcamento.vercel.app
- VITE_API_URL deve apontar ao backend Railway

### Seguranca
- Rotacionar ANTHROPIC_API_KEY em console.anthropic.com
- Nunca usar Raw Editor Railway com chaves sensiveis
