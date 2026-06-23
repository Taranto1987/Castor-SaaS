# ESTADO DA INVESTIGAÇÃO — CONSOLIDADO (Runtime + Código)

**Data da coleta:** 2026-06-06
**Repositório:** Taranto1987/Castor-SaaS
**Branch analisada (código):** `fix/logistica-auth-401`
**HEAD commit:** `bd5db8ba7f57b97f5037dcd3aeee72e41984fa3f` — "fix(logistica): adiciona x-session-token nas chamadas à API de entregas" (Claude, 2026-06-05)

> Objetivo deste documento: dar contexto completo (runtime + estrutural) para Claude Code/Codex continuar a investigação **sem recomeçar do zero**. Indica explicitamente o que está provado e o que ainda falta provar.

---

## BLOCO A — RUNTIME (Railway) — coletado via Railway Agent

### Ambiente
- Projeto: `diligent-endurance`
- Serviços online: `evolution-api`, `eloquent-laughter`, `Postgres` (3/3 online, 0 em crash)

### evolution-api (api-server Castor)
- Status: Online
- Último deploy: 2026-06-06T11:34:33.023Z — SUCCESS
- Repo/branch: Taranto1987/Castor-SaaS @ `main`
- URL: https://evolution-api-production-405f.up.railway.app
- Vars: DATABASE_URL, CASTOR_AGENT_ID, CASTOR_ENVIRONMENT_ID, NODE_ENV, AI_INTEGRATIONS_OPENAI_BASE_URL, DATABASE_PROVIDER, PORT, AUTHENTICATION_API_KEY, AI_INTEGRATIONS_GEMINI_API_KEY, AI_INTEGRATIONS_GEMINI_BASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY, AI_INTEGRATIONS_OPENAI_API_KEY

### Postgres
- Status: Online | Imagem: ghcr.io/railwayapp-templates/postgres-ssl:18 | Volume: /var/lib/postgresql/data | 1 replica running
- Vars: DATABASE_URL, DATABASE_PUBLIC_URL, PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD

### Startup / Deploy (logs)
- `[reconcile] aplicados=0 já_existiam=73 falhas=0`
- `[reconcile] backfill leads = +0`
- Server listening | Sessions hydrated from DB | Lojas verificadas/seedadas | Usuários seed sincronizados
- Healthcheck: passou | Última request observada ~57ms

### Warnings (vars opcionais ausentes → "feature disabled")
EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_WEBHOOK_TOKEN, WAHA_URL, WAHA_WEBHOOK_SECRET, WHATSAPP_PROVIDER, WHATSAPP_API_URL, WHATSAPP_API_TOKEN, WHATSAPP_INSTANCE_ID, **ALLOWED_ORIGINS**

### Erros observados
- `scheduler_cycle_error` @ 2026-06-06T17:35:36 (sem stack trace coletada)

---

## BLOCO B — CÓDIGO (auditoria estrutural via repositório)

### B.1 — Backend que DEVE responder `/api/leads`
- Definição: `artifacts/api-server/src/routes/leads.ts` → `router.get("/leads", requireAuth, ...)`
- Montagem: `artifacts/api-server/src/routes/index.ts:55` → `router.use("/leads", leadsRouter)` (montado sob `/api`)
- Handler filtra por tenant: `const lojaId = req.session!.lojaId;` → `where(eq(leadsTable.lojaId, lojaId))`
- **Conclusão:** a rota `GET /api/leads` existe e pertence ao **api-server** = serviço Railway **`evolution-api`** = `https://evolution-api-production-405f.up.railway.app`. Esse é o ÚNICO backend que responde `/api/leads`.

### B.2 — Por que o frontend chama o host errado
- 3 páginas leem o host de `import.meta.env.VITE_API_URL` (baked no build Vite):
  - `artifacts/castor-orcamento/src/pages/Clientes.tsx:21` — `const API_URL = import.meta.env.VITE_API_URL ?? "";`
  - `artifacts/castor-orcamento/src/pages/Inbox.tsx:14` — idem
  - `artifacts/castor-orcamento/src/pages/ClienteDetalhe.tsx:19` — idem
- `.env.example:48` documenta o valor correto: `VITE_API_URL=https://evolution-api-production-405f.up.railway.app`
- **Conclusão:** o navegador resolve para `workspaceapi-server-production-69cc...` porque a `VITE_API_URL` configurada no build do Vercel aponta para um host que **não é** o `evolution-api`. Erro de configuração de deploy do frontend, não de código de runtime.

### B.3 — Por que aparece "CORS" no navegador (não é CORS quebrado)
- `artifacts/api-server/src/app.ts:21-24`:
  ```ts
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",")...filter(Boolean);
  app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : undefined, credentials: true }));
  ```
- `ALLOWED_ORIGINS` está AUSENTE no runtime (Bloco A) → `origin: undefined` → o pacote `cors` **reflete qualquer origem** (libera tudo).
- **Conclusão:** o backend correto NÃO recusaria por CORS. O "erro de CORS" no DevTools é **sintoma do 404 no preflight OPTIONS** num host sem a rota. Causa raiz = host/endpoint errado (B.2), não política de CORS.

### B.4 — Cadeia observável confirmada (navegador)
```
GET /api/leads  →  host VITE_API_URL (workspaceapi-server-production-69cc...)  →  OPTIONS 404  →  navegador reporta CORS
```
Isso REFUTA a hipótese de cache do React Query: houve requisição real, host resolvido e erro pós-tentativa.

### B.5 — Inventário estrutural
**Rotas (`artifacts/api-server/src/routes/`):** agent, analytics, auth, catalog, chat, crawler, dashboard, diagnostico, entrada-estoque, entregas, financeiro, followup, health, inbox, index, leads, loja, mcp, operacoes, orcamento, outcomes, produtos, scoring, sitemap, twin, usuarios, waha, whatsapp

**Schema Drizzle (`lib/db/src/schema/`):** ai-usage, automation-log, chat-events, colaboradores, customer-profiles, diagnosticos, entradas-estoque, entregas, eventos-operacionais, financeiro, follow-ups, lead-contexts, lead-scores, leads, lojas, mensagens-whatsapp, orcamentos, product-families, produtos, relational-capsules, sales-opportunities, scheduler-locks, sessions, sleep-outcomes, tool-executions, usuarios, whatsapp-instances

**Multi-tenant (`lojaId`):** 539 ocorrências em 62 arquivos sob `artifacts/api-server/src`. Filtros por tenant presentes nas rotas críticas (entregas:15, financeiro:14, leads:31, orcamento:8, operacoes:4, inbox:28, produtos:37).

**`fecharVendaTransaction()`:** definida em `artifacts/api-server/src/services/orcamento/repository.ts:84`; usada em `artifacts/api-server/src/routes/orcamento.ts:68`. ⚠️ Auditoria anterior (AUDITORIA_OPERACIONAL_REAL_2026-05-28.md:136) aponta que atualiza orçamento/estoque por `id` **sem `lojaId` obrigatório dentro da transação** — revisar.

**`x-session-token`:** presente em 33 arquivos (frontend + backend + spec). Auth via header validado em `artifacts/api-server/src/middlewares/auth.ts`.

---

## ESTADO DA INVESTIGAÇÃO

| Evidência | Status |
|---|---|
| Runtime (Railway/Postgres/logs/deploy) | ✓ coletada |
| Estrutural (código/rotas/schema/queries) | ✓ coletada |
| SQL real (contagens) | ✗ não coletada |
| Payloads reais de endpoints | ✗ não coletados |
| Distribuição por `loja_id` | ✗ não coletada |

### O que JÁ está provado
✓ Railway operacional, deploy SUCCESS, evolution-api + Postgres online
✓ DATABASE_URL existe, serviço conectado, sessões carregadas do banco, seed de lojas executada, 73 objetos/schema, healthcheck OK
✓ `GET /api/leads` existe e pertence ao api-server (host correto = `evolution-api-production-405f`)
✓ Causa raiz do bug do CRM = `VITE_API_URL` apontando para host errado (não cache, não CORS)
✓ "Erro de CORS" é sintoma do 404 no host errado (CORS do backend correto libera tudo por ALLOWED_ORIGINS ausente)

### O que AINDA NÃO está provado (requer SQL read-only)
✗ Contagens reais: leads, sales_opportunities, orcamentos, entregas, sessions, lojas
✗ Distribuição por `loja_id`
✗ Resultado real de GET /api/leads, /api/operacoes, /api/orcamento/historico, /api/entregas
✗ Execução real de `fecharVendaTransaction()`

### Próximo bloqueio técnico
Acesso SQL **read-only** ao Postgres Railway para:
```sql
SELECT count(*) FROM leads;
SELECT count(*) FROM sales_opportunities;
SELECT count(*) FROM orcamentos;
SELECT count(*) FROM entregas;
SELECT count(*) FROM sessions;
SELECT count(*) FROM lojas;
SELECT loja_id, count(*) FROM leads GROUP BY loja_id;
```

### Próxima AÇÃO recomendada (correção do bug do CRM)
Corrigir `VITE_API_URL` no projeto Vercel do frontend para `https://evolution-api-production-405f.up.railway.app` e **rebuild/redeploy** do frontend. Nenhuma alteração de código de backend é necessária para resolver o 404/CORS do CRM.
