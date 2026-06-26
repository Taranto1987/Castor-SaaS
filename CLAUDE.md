# CLAUDE.md
<!-- updated: 2026-06-26 -->

Este arquivo orienta o Claude Code ao trabalhar neste repositorio.

## Comandos

### Desenvolvimento
```bash
# Frontend (React + Vite)
pnpm --filter @workspace/castor-orcamento run dev

# Backend (Express API)
pnpm --filter @workspace/api-server run dev
```

### Build & Typecheck
```bash
# Typecheck completo do monorepo (composite project references)
pnpm run typecheck

# Build completo
pnpm run build

# Build individual
pnpm --filter @workspace/castor-orcamento run build
pnpm --filter @workspace/api-server run build
```

### Lint
```bash
pnpm run lint
pnpm run lint:fix
```

### Database
```bash
# Push schema (idempotente via reconcile.mjs)
pnpm --filter @workspace/db run push

# Force push (DESTRUTIVO — recria colunas)
pnpm --filter @workspace/db run push-force
```

### Codegen (API → Hooks + Zod)
```bash
# Regenera React Query hooks e Zod schemas a partir do OpenAPI
pnpm --filter @workspace/api-spec run codegen
```

### Scripts utilitarios
```bash
pnpm --filter @workspace/scripts run backfill-slugs
pnpm --filter @workspace/scripts run backfill-family
```

Nao existe framework de testes configurado neste projeto.

---

## Arquitetura

### Estrutura do Monorepo (pnpm workspaces)
```
artifacts/          — Aplicacoes deployaveis
  castor-orcamento/ — React + Vite SPA (frontend)
  api-server/       — Express 5 REST API (backend)
  mockup-sandbox/   — Ambiente de teste de componentes
lib/                — Pacotes internos compartilhados
  db/               — Drizzle ORM + schema PostgreSQL
  api-spec/         — OpenAPI spec + config Orval
  api-client-react/ — Hooks React Query gerados (Orval)
  api-zod/          — Schemas Zod gerados (Orval)
  integrations-gemini-ai/   — Google Gemini Vision (OCR NF-e)
  integrations-openai-ai-server/ — OpenAI fallback (chat, imagem, audio)
scripts/            — Scripts CLI utilitarios (backfill-slugs, backfill-family)
```

### Fluxo de Dados (API Contract)
A fonte da verdade do contrato vive em `lib/api-spec/openapi.yaml`. Rodar `pnpm --filter @workspace/api-spec run codegen` regenera:
- React Query hooks → `lib/api-client-react/src/generated/`
- Zod schemas → `lib/api-zod/src/generated/types/`

O frontend importa esses hooks gerados. **Nunca escrever `fetch` manual** para rotas que estao no spec.

### Stack Tecnica
| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Runtime | Node.js | 22 |
| Package Manager | pnpm | 10.13.1 |
| TypeScript | strict mode | 5.9.2 |
| Frontend | React + Vite + Tailwind CSS 4 | React 19.1, Vite 7.3, TW 4.1 |
| Router | wouter | 3.3.5 |
| Data Fetching | TanStack React Query | 5.90.21 |
| UI | Radix UI + shadcn/ui (CVA + clsx) | — |
| Animacao | Framer Motion | 12.35.1 |
| Backend | Express 5 | — |
| ORM | Drizzle ORM | 0.45.1 |
| Banco | PostgreSQL | 16 |
| Validacao | Zod | 3.25.76 |
| Logging | Pino (estruturado) | 9 |
| AI primario | Anthropic SDK (Claude Sonnet 4.6) | 0.90.0 |
| AI vision | Google Gemini 2.0 Flash | — |
| AI fallback | OpenAI (GPT-4o-mini) | — |
| Build backend | esbuild | 0.27.3 |

---

## Backend (`artifacts/api-server/`)

### Entry Points
- `src/index.ts` — Boot: validateEnv → listen → inicia schedulers + seeds + sessions
- `src/app.ts` — Express config: helmet, CORS, rate limiters, request context, error handler

### Inicializacao (ordem no boot)
1. `validateEnv()` — falha hard se `DATABASE_URL` ou `PORT` faltam
2. `app.listen(PORT)` → callback:
   - `iniciarSchedulerRecorrentes()` — despesas recorrentes (setInterval)
   - `iniciarSchedulerFollowUps()` — follow-ups automaticos (setInterval)
   - `cleanupExpiredSessions()` + `hydrateSessionsFromDB()` — sessoes em memoria
   - `seedLojas()` + `seedColaboradores()` — dados iniciais
   - `refreshLojaRegistry()` — whitelist de lojas ativas (refresh a cada 5min)

### Shutdown graceful
SIGTERM/SIGINT → para schedulers → fecha server → encerra pool DB (timeout 30s)

### Autenticacao
- `POST /api/auth/login` → retorna token (sessionStorage no frontend)
- Header `x-session-token` em rotas privadas
- Sessoes em memoria (`lib/sessions.ts`) hidratadas do DB no boot
- Middlewares: `requireAuth` (qualquer usuario autenticado), `requireDono` (papel dono/ADMIN/GERENTE)
- Roles: `ADMIN | GERENTE | VENDEDOR | FINANCEIRO | ENTREGA`

### Rate Limiting (por endpoint)
| Endpoint | Limite |
|----------|--------|
| `/api/auth/login` | 20/15min |
| `/api/auth/esqueci-senha` | 5/15min |
| `/api/chat` | 30/15min |
| `/api/agent/` | 20/hora |
| `/api/mcp` | 60/hora |
| `/api/crawler` | 300/hora |
| `/api/produtos` | 200/15min |
| `/api/financeiro`, `/api/dashboard` | 100/15min |
| `/api/whatsapp/connect` | 5/15min |

### Rotas (`src/routes/`)
| Arquivo | Mount | Dominio |
|---------|-------|---------|
| `health.ts` | `/healthz`, `/healthz/deep` | Liveness + deep check (DB pool, AI usage) |
| `auth.ts` | `/api/auth` | Login, logout, senha, reset token |
| `usuarios.ts` | `/api/usuarios` | CRUD usuarios, convites, roles |
| `produtos.ts` | `/api/produtos` | Catalogo, busca, outlet, estoque |
| `orcamento.ts` | `/api/orcamento` | Orcamentos, historico, fechar venda |
| `entregas.ts` | `/api/entregas` | CRUD entregas, eventos logistica |
| `dashboard.ts` | `/api/dashboard` | KPIs, metricas de venda |
| `financeiro.ts` | `/api/financeiro` | Despesas, recorrentes, comissoes, DRE, metas |
| `entrada-estoque.ts` | `/api/entrada-estoque` | Entrada via foto (OCR Gemini) |
| `crawler.ts` | `/api/crawler` | Scraper Playwright (catalogo fornecedor) |
| `chat.ts` | `/api/chat` + `/api/agente` | Chat IA ThallesZzz (SSE streaming) |
| `agent.ts` | `/api/agent` | Anthropic Agents API |
| `leads.ts` | `/api/clientes` | CRM leads, pipeline, interacoes |
| `inbox.ts` | `/api/inbox` | Conversas WhatsApp (SSE stream, enviar, assumir) |
| `whatsapp.ts` | `/api/whatsapp` | Lifecycle instancias WhatsApp |
| `waha.ts` | (root) | Webhook WAHA (fallback WhatsApp) |
| `diagnostico.ts` | (root) | Mapa do Sono — motor biomecanico |
| `mapa-sono.ts` | (root) | Config Mapa do Sono |
| `outcomes.ts` | (root) | Satisfacao pos-venda (30d/90d/180d/365d) |
| `scoring.ts` | (root) | Lead scoring engine |
| `operacoes.ts` | (root) | Central de Operacoes (COCA) |
| `catalog.ts` | (root) | Familias e categorias de produto |
| `followup.ts` | `/api/followup` | Follow-ups pendentes/executados |
| `loja.ts` | (root) | Config multi-tenant por loja |
| `analytics.ts` | (root) | Analytics de chat |
| `ai-custos.ts` | (root) | Dashboard de custos IA |
| `twin.ts` | (root) | Digital Twin (customer profiles) |
| `mcp.ts` | (root) | MCP Server (Model Context Protocol) |
| `sitemap.ts` | `/sitemap.xml` | SEO sitemap (fora de /api) |

### Services (`src/services/`)
| Dominio | Arquivos | Funcao |
|---------|----------|--------|
| `chat/` | repository, lead-extractor, prompt, fallback | Chat IA, extracao de leads da conversa |
| `leads/` | index, repository, types, mapa-sono | Agregacao CRM, perfil biomecanico |
| `produtos/` | index, repository, pricing, mappers, types | Catalogo, pricing engine, outlet |
| `orcamento/` | repository, generator, types | Geracao de orcamentos |
| `finance/` | repository, dre, types | Despesas, DRE, comissoes |
| `operacoes/` | repository | Central de operacoes (COCA) |
| `scoring/` | engine, signals, weights, rules, automations, updater | Lead scoring (intencao, probabilidade, trend) |
| `memory/` | identity, capsule | Digital Twin: stitching de identidade, capsulas relacionais |
| `tenant/` | context, geo-routing | Isolamento multi-tenant, roteamento geografico |
| `eventos/` | classifier, emit, types | Classificacao e emissao de eventos operacionais |
| `whatsapp/` | evolution-client, instance-manager | Cliente Evolution API |
| `usuarios/` | repository | CRUD usuarios |
| `catalog/` | repository | Familias de produto |
| `shared/` | currency, date, types | Utilitarios compartilhados (parseBRL, formatBRL) |

### Libs internas (`src/lib/`)
| Arquivo | Funcao |
|---------|--------|
| `logger.ts` | Pino logger com requestId |
| `sessions.ts` | Store de sessoes em memoria + hidratacao do DB |
| `seed-lojas.ts` | Inicializacao de lojas default |
| `rbac.ts` | RBAC (role-based access control) |
| `ai-usage.ts` | Tracking de custo IA (tokens, modelo, contexto) |
| `feature-flags.ts` | Feature toggles |
| `motor.ts` + `motor-v2.ts` + `motor-regras.ts` | Motor de compatibilidade sono/colchao |
| `markup-engine.ts` | Engine de markup/precificacao |
| `nfe-parser.ts` | Parser de NF-e (nota fiscal) |
| `castor-agent.ts` | Integracao Anthropic Agents |
| `tool-runner.ts` + `tools/` | Definicoes e execucao de tools para agente/chat |
| `mcp/` | MCP Server (server.ts, tools/catalog.ts, tools/orcamento.ts) |
| `followup-scheduler.ts` | Scheduler de follow-ups (setInterval) |
| `recorrentes-scheduler.ts` | Scheduler de despesas recorrentes (setInterval) |
| `log-event.ts` | Helper para emitir eventos operacionais |

---

## Frontend (`artifacts/castor-orcamento/`)

### Entry Point
`src/main.tsx` → `src/App.tsx`

### Provider Tree
```
QueryClientProvider → TooltipProvider → ThemeProvider → LojaProvider → AuthProvider → CommandPaletteProvider → WouterRouter → ErrorBoundary → AppRoutes
```

### Contextos (`src/contexts/`)
- `AuthContext.tsx` — Estado auth (email, token, role, loja) em `sessionStorage`
- `LojaContext.tsx` — Contexto multi-tenant (loja selecionada)
- `ThemeContext.tsx` — Tema claro/escuro (next-themes)

### QueryClient Config
- staleTime: 5min, gcTime: 10min
- refetchOnMount/WindowFocus/Reconnect: desabilitado
- retry: 1

### Rotas
**Publicas (eager load, SEO-critical):**
| Rota | Componente | Descricao |
|------|-----------|-----------|
| `/` | Landing (ou redirect → /operacoes se logado) | Homepage marketing |
| `/catalogo` | Catalogo | Catalogo publico de produtos |
| `/mapa-sono` | MapaSono | Quiz diagnostico do sono |
| `/produto/:slug` | ProdutoDetalhe | Detalhe do produto |

**Landing Pages (lazy):**
`/lp/luxo`, `/lp/box-bau`, `/lp/outlet`, `/lp/saude-coluna`, `/lp/entrega-24h`

**Auth (lazy):**
`/aceitar-convite`, `/redefinir-senha`

**Privadas — PrivateRoute (qualquer autenticado):**
| Rota | Componente |
|------|-----------|
| `/equipe` | Home |
| `/orcamento` | Orcamento |
| `/historico` | Historico |
| `/operacoes` | Operacoes (COCA — tela principal) |
| `/dashboard` | Dashboard |
| `/logistica` | Logistica |
| `/crawler` | Crawler |
| `/equipe/clientes` | Clientes (CRM) |
| `/equipe/clientes/:id` | ClienteDetalhe |
| `/inbox` | Inbox (WhatsApp) |
| `/outlet` | Outlet |
| `/financeiro` | Financeiro |

**Admin — DonoRoute (dono/ADMIN/GERENTE):**
| Rota | Componente |
|------|-----------|
| `/estoque` | Estoque |
| `/ranking-outlet` | RankingOutlet |
| `/entrada-estoque` | EntradaEstoque |
| `/usuarios` | Usuarios |
| `/diagnosticos` | Outcomes |
| `/ai-custos` | AICustos |

### Componentes-chave
- `Layout.tsx` — Sidebar nav + header + area principal
- `PublicLayout.tsx` — Header + footer para paginas publicas
- `LoginScreen.tsx` — Formulario de login
- `ChatBot.tsx` — Widget de chat IA (ThallesZzz)
- `CommandPalette.tsx` — Paleta de comandos (Ctrl+K)
- `ProductCard.tsx` / `ProductCardGrouped.tsx` — Cards de produto
- `ProductPicker.tsx` — Seletor de produto para orcamentos
- `CatalogFilters.tsx` — Filtros do catalogo
- `MapaSonoModal.tsx` — Quiz do sono embedded
- `ErrorBoundary.tsx` — Error boundary React

---

## Database (`lib/db/`)

### Config
- Drizzle ORM com driver `pg` (pool via `DATABASE_URL`)
- Schemas em `lib/db/src/schema/` — um arquivo por dominio
- `drizzle-zod` gera schemas Zod automaticamente das tabelas
- Sem pasta de migrations — schema gerenciado via `push` (reconcile.mjs)

### Tabelas (28 schema files)

**Core:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `lojas` | lojas.ts | Tenants (nome, dominio, config JSON de pricing) |
| `usuarios` | usuarios.ts | Usuarios + staff (roles: ADMIN/GERENTE/VENDEDOR/FINANCEIRO/ENTREGA) |
| `sessions` | sessions.ts | Sessoes auth (token, user_id, expires_at) |

**Produtos & Catalogo:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `produtos` | produtos.ts | Catalogo (SKU, slug, preco, estoque, sales_mode, ficha_tecnica JSONB) |
| `product_families` | product-families.ts | Agrupamento de variantes (ex: "Castor Excellence") |
| `crawler_status` | (em produtos.ts) | Estado do scraper (idle/running/completed/error) |
| `outlet_interesses` | (em produtos.ts) | Wishlist de itens outlet |

**Vendas & Orcamentos:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `orcamentos` | orcamentos.ts | Orcamentos/propostas (produtos_json, total, vendedor, status) |
| `sales_opportunities` | sales-opportunities.ts | Oportunidades de venda (COCA pipeline) |
| `entregas` | entregas.ts | Entregas (endereco, status, orcamento_id) |
| `entradas_estoque` | entradas-estoque.ts | Entradas de estoque (origem, itens_json, comprovante) |

**CRM & Leads:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `leads` | leads.ts | Leads CRM (estagio pipeline, perfil_biomecanico, score_intencao) |
| `lead_interacoes` | (em leads.ts) | Log de interacoes por lead |
| `lead_tarefas` | (em leads.ts) | Tarefas/acoes por lead |
| `customer_profiles` | customer-profiles.ts | Digital Twin — perfil agregado por telefone |
| `relational_capsules` | relational-capsules.ts | Capsulas de memoria relacional (JSONB) |
| `lead_scores` | lead-scores.ts | Scoring engine (score, categoria, signals, trend, closing_probability) |
| `lead_contexts` | lead-contexts.ts | Snapshots de contexto do lead |

**Financeiro:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `despesas` | financeiro.ts | Despesas (valor, categoria, data, confirmada) |
| `despesas_recorrentes` | financeiro.ts | Despesas recorrentes (dia_vencimento, ativo) |
| `comissoes_config` | financeiro.ts | Config de comissao por vendedor (unique: vendedor+loja_id) |
| `metas` | financeiro.ts | Metas mensais por operacao |

**WhatsApp & Messaging:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `conversas_whatsapp` | (em mensagens-whatsapp.ts) | Conversas WA (status: bot/humano/resolvido) |
| `mensagens_whatsapp` | mensagens-whatsapp.ts | Mensagens WA (direcao, tipo, dedup por waha_message_id) |
| `whatsapp_instances` | whatsapp-instances.ts | Instancias Evolution API (status: connected/disconnected) |

**Diagnostico & Outcomes:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `diagnosticos` | diagnosticos.ts | Resultados do Mapa do Sono (produto_recomendado, perfil_biomecanico, perfil_comportamental) |
| `sleep_outcomes` | sleep-outcomes.ts | Satisfacao pos-venda (30d/90d/180d/365d, NPS, sleep_success_score) |

**Eventos & Tracking:**
| Tabela | Schema File | Descricao |
|--------|-------------|-----------|
| `eventos_operacionais` | eventos-operacionais.ts | Eventos de negocio (tipo, entidade_id, detalhes JSONB) |
| `chat_events` | chat-events.ts | Eventos de sessao de chat |
| `ai_usage` | ai-usage.ts | Custo IA (modelo, tokens input/output/cache, custo_estimado) |
| `tool_executions` | tool-executions.ts | Log de execucao de tools do agente |
| `automation_log` | automation-log.ts | Audit trail de automacoes |
| `follow_ups` | follow-ups.ts | Follow-ups agendados (tipo, data, pendente) |
| `scheduler_locks` | scheduler-locks.ts | Locks distribuidos para schedulers |

### Indices compostos unicos (multi-tenant)
```sql
produtos (sku, loja_id)                    -- SKU unico por loja
produtos (slug, loja_id)                   -- slug unico por loja
comissoes_config (vendedor, loja_id)       -- uma config de comissao por vendedor por loja
mensagens_whatsapp (loja_id, waha_message_id) -- dedup de webhooks WA
```

### Relacoes-chave (FKs)
```
leads → customer_profiles (customer_profile_id)
leads → orcamentos (lead_id)
leads → diagnosticos (lead_id)
customer_profiles → relational_capsules (customer_id)
customer_profiles → lead_scores (customer_id)
diagnosticos → sleep_outcomes (diagnostico_id)
orcamentos → entregas (orcamento_id)
ai_usage → lojas (loja_id)
```

---

## Stack de IA

### Config atual (nao alterar sem motivo)
| Funcao | Modelo | Detalhes |
|--------|--------|---------|
| Chat (ThallesZzz) | `claude-sonnet-4-6` | SSE streaming, 2-pass, tool budget MAX 2/turn |
| Extracao estruturada | `claude-haiku-4-5-20251001` | Skipped para `intent=low` |
| Vision/OCR (NF-e) | Gemini 2.0 Flash | Foto de nota fiscal → itens de estoque |
| Fallback chat | GPT-4o-mini | Se Anthropic indisponivel |
| Agents | Anthropic Agents API | `CASTOR_AGENT_ID` + `CASTOR_ENVIRONMENT_ID` |
| Cache | `ephemeral` em SYSTEM_PROMPT | Upgrade para `persistent` quando SDK suportar |
| Cost tracking | Tabela `ai_usage` + log `event=session_complete` | Tokens + custo estimado por sessao |

### MCP Server
Backend expoe um MCP Server em `/api/mcp` com tools:
- `catalog` — consulta de catalogo
- `orcamento` — geracao de orcamentos

---

## Variaveis de Ambiente

### Obrigatorias (boot falha sem)
| Variavel | Descricao |
|----------|-----------|
| `DATABASE_URL` | Connection string PostgreSQL |
| `PORT` | Porta HTTP (3000 em producao) |

### IA (opcionais — degradam com warning)
| Variavel | Descricao |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Claude AI (chat + agente) |
| `CASTOR_AGENT_ID` | ID do agente Anthropic |
| `CASTOR_ENVIRONMENT_ID` | ID do ambiente Anthropic |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI fallback (chat ThallesZzz) |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Gemini Vision (OCR NF-e) |

### WhatsApp (opcionais — follow-up nao envia sem)
| Variavel | Descricao |
|----------|-----------|
| `EVOLUTION_API_URL` | Evolution API base URL |
| `EVOLUTION_API_KEY` | Evolution API auth token |
| `EVOLUTION_WEBHOOK_TOKEN` | Validacao de webhook |
| `WAHA_URL` | WAHA fallback base URL |
| `WAHA_WEBHOOK_SECRET` | WAHA auth secret |
| `WHATSAPP_PROVIDER` | Seletor: `evolution` (default) ou `waha` |

### Infra (opcionais)
| Variavel | Descricao |
|----------|-----------|
| `NODE_ENV` | `development` ou `production` |
| `LOG_LEVEL` | Pino: trace/debug/info/warn/error |
| `ALLOWED_ORIGINS` | CORS allowlist (virgula-separadas) |

### Frontend (build-time, Vite)
| Variavel | Descricao |
|----------|-----------|
| `VITE_API_URL` | API endpoint (opcional — usa proxy /api por default) |
| `BASE_PATH` | Base do router Vite |
| `VITE_GTM_ID` | Google Tag Manager |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 |
| `VITE_GOOGLE_ADS_ID` | Google Ads conversion tracking |
| `SITE_URL` | Dominio canonico |

### Nao usadas (removidas)
- `REDIS_URL` / BullMQ — schedulers usam setInterval
- `ZAPI_TOKEN` — sem implementacao no codigo

---

## Estado do Projeto — Jun/2026

**Contexto operacional:**
- Nao existem clientes reais cadastrados ainda
- O site principal ainda nao foi lancado publicamente
- Nao existem diagnosticos reais em producao
- Nao existem vendas originadas pelo sistema
- Nao existem outcomes reais coletados
- Nao existem metricas suficientes para calibracao de algoritmos

**Conclusao:** O sistema esta em fase de construcao da fundacao de inteligencia, nao em fase de otimizacao.

**Prioridades desta fase:**
- Coleta de dados estruturada
- Persistencia e rastreabilidade
- Integracao entre modulos existentes
- Isolamento multi-tenant
- Qualidade dos dados coletados

**O que evitar:**
- Overengineering e novas infraestruturas complexas
- Entidades ou tabelas duplicadas
- Arquiteturas paralelas ao que ja existe
- Algoritmos dependentes de volume de dados inexistente

**Digital Twin — fundacoes existentes (NAO duplicar):**
- `customer_profiles` + `relational_capsules` + `lead_scores` + `lead_score_history`
- `resolveOrCreateCustomer()` + `stitchIdentityByPhone()` em `services/memory/identity.ts`
- `diagnosticos` + `sleep_outcomes` conectados via `customerId` FK

**COCA — Central de Operacoes Comerciais Autonoma:**
- Fases 0-6 implementadas (ver `COCA_PLAN.md` para detalhes)
- `sales_opportunities` — pipeline de oportunidades
- Follow-up engine: cadencia FOLLOWUP_D2/D5/D10 + REATIVACAO_D30 + RECUPERACAO_D60
- Pos-venda integrado com entregas (fase 6, ativo com credenciais Evolution)
- `/operacoes` e a tela principal para usuarios logados

**Visao alvo (ciclo completo):**
```
Lead → Diagnostico → Compatibilidade → Recomendacao → Venda → Resultado → Aprendizado → Recalibracao
```

**Principio central: dados antes de algoritmos.**

Antes de criar nova tabela ou agregado: verificar se o problema e ausencia de integracao ou ausencia real de modelagem.

---

## Contexto de Dominio

Castor-SaaS e uma plataforma SaaS para rede de lojas de colchoes. Features de negocio:

- **Orcamento** — geracao de orcamentos com envio via WhatsApp (links wa.me pre-formatados)
- **Catalogo** — catalogo publico com filtros, agrupamento por familia, paginas de produto com SEO
- **Estoque** — gestao de estoque (pronta_entrega vs sob_encomenda vs outlet vs hidden)
- **Financeiro** — despesas, comissoes, DRE (demonstrativo de resultado), metas mensais
- **Logistica** — roteamento de entregas com integracao Google Maps
- **CRM (Clientes)** — pipeline de leads agregados por telefone/nome com tracking de conversao
- **Mapa do Sono** — quiz diagnostico biomecanico → recomendacao de colchao
- **Crawler** — scraper headless Playwright para auto-atualizar catalogo do fornecedor
- **Chat (ThallesZzz)** — assistente de vendas IA em paginas publicas, SSE streaming
- **Inbox** — central de conversas WhatsApp (bot → humano → resolvido)
- **COCA** — Central de Operacoes Comerciais (pipeline, follow-ups, margens criticas)
- **AI Custos** — dashboard de custo por modelo/contexto de IA
- **Landing Pages** — paginas de conversao SEO (luxo, box-bau, outlet, saude-coluna, entrega-24h)

---

## Principios Arquiteturais

### Criterios de decisao (em ordem de prioridade)
1. Preservar integridade de dados — isolamento multi-tenant e nao-negociavel
2. Preservar visibilidade operacional — se nao e observavel, nao vai pra prod
3. Preservar custo unitario saudavel — custo IA por sessao deve ser mensuravel
4. Evitar complexidade prematura — sem abstracao sem evidencia concreta de necessidade
5. Expandir apenas com sinal claro — logs mostrando gargalos reais, nao hipoteticos

### Na duvida entre duas abordagens, preferir a que:
- Mantem o sistema observavel (logs Pino estruturados, `/healthz/deep`)
- Reduz risco de corrupcao silenciosa (filtros lojaId, uniques compostos)
- Conserva simplicidade operacional (monolito e correto na escala atual)
- Melhora margem sem acoplamento desnecessario

### Antes de qualquer alteracao de schema
**OBRIGATORIO:** Rodar queries de validacao contra o Postgres do Railway antes de aplicar `db push`:
```sql
-- Exemplo para migracao de unique composto:
SELECT <key_col>, loja_id, COUNT(*) FROM <table>
GROUP BY <key_col>, loja_id HAVING COUNT(*) > 1;
```
Se retornar duplicatas → limpar dados primeiro, depois push. Nunca aplicar constraint sobre dados sujos.

### O que NAO pertence a este codebase na escala atual
| Tecnologia | Motivo |
|-----------|--------|
| RAG / pgvector / semantic search | Sem evidencia de falha de retrieval > 20% |
| BullMQ / Redis | Schedulers corretos com setInterval ate ~50 tenants |
| Microservices / multi-region | Monolito e correto hoje |
| LangChain / orquestracao | SDK Anthropic direto e mais simples e barato |
| Sentry / Datadog | Defer ate Railway logs provarem insuficiencia |

---

## Deploy — Railway (Producao)

### REGRA ABSOLUTA — PROJETO UNICO (CFO RULE)

**PROIBICOES IMUTAVEIS:**
- NUNCA criar novo projeto Railway
- NUNCA criar novo ambiente Railway
- NUNCA duplicar servicos (backend, banco, frontend)
- NUNCA iniciar infraestrutura fora do projeto `diligent-endurance`

**ANTES de qualquer criacao de servico:**
1. Verificar se ja existe no projeto `diligent-endurance`
2. Se existir → reutilizar obrigatoriamente
3. Se nao existir → criar DENTRO de `diligent-endurance` apenas

**Deploy automatico:** APENAS via branch `main`. Feature branches NAO fazem deploy no Railway.

### Servicos no projeto diligent-endurance
| Service | Tipo | URL |
|---------|------|-----|
| Postgres | Railway Postgres | (internal) |
| evolution-api | api-server Castor | https://evolution-api-production-405f.up.railway.app |
| eloquent-laughter | Evolution API v2.2.3 | https://eloquent-laughter-production-a0b7.up.railway.app |

### Config critica do service
- **Dockerfile:** Multi-stage (base → builder → production, Node 22-alpine, non-root appuser)
- **Pre-deploy:** `pnpm --filter @workspace/db run push` (reconcile idempotente)
- **Start:** `pnpm --filter @workspace/api-server start`
- **Healthcheck:** `/api/healthz` (timeout 30s, 3 retries, restart on failure max 10x)
- **Public port:** 3000

### Frontend — Vercel
- Projeto: `castor-saa-s-castor-orcamento`
- URL: castor-saa-s-castor-orcamento.vercel.app
- `vercel.json` faz rewrite `/api/*` → backend Railway
- Branches `claude/*` sao ignoradas pelo build step (guard de custo)
- Plano Hobby — sem compilacoes simultaneas

### Env vars no Railway (api-server)
- `DATABASE_URL` — auto Railway Postgres
- `DATABASE_PROVIDER=postgresql`
- `PORT=3000`
- `NODE_ENV=production`
- `ANTHROPIC_API_KEY` — inserir manualmente
- `CASTOR_AGENT_ID` + `CASTOR_ENVIRONMENT_ID`

Faltando (adicionar via painel):
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_GEMINI_API_KEY`

### Seguranca
- Rotacionar `ANTHROPIC_API_KEY` em console.anthropic.com
- Nunca usar Raw Editor Railway com chaves sensiveis
- WhatsApp: links wa.me manuais (envio automatico depende de `EVOLUTION_*`)

---

## CI/CD (`.github/workflows/`)

### `ci.yml` — Integracao Continua
- **Triggers:** push para main/develop/release/**/claude/**, PRs
- **Concurrency:** Cancela runs em progresso na mesma branch
- **Jobs:**
  1. `typecheck` — `pnpm run typecheck` (Node 22, pnpm frozen-lockfile)
  2. `build` (depende de typecheck) — build frontend + api-server

### `railway-deploy-guard.yml` — Protecao de deploy
- Previne deploy de branches que nao sao main

### `security.yml` — Scan de seguranca
- Auditoria de dependencias e secrets
