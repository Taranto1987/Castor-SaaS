# CLAUDE.md

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
