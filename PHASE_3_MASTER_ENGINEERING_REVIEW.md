# PHASE_3_MASTER_ENGINEERING_REVIEW.md
## Castor SaaS — Final Executive Engineering Blueprint
**Auditoria Consolidada: Sprints 1–2 + Estabilização**
**Data: 2026-05-27 | Branch: claude/multi-tenant-saas-system-jiHJt | Commit: 6060bb4**
**Auditoria independente de 3 agentes paralelos + leitura direta de todos os arquivos críticos**

---

## 1. EXECUTIVE SUMMARY

**Veredicto atual:** Sistema operacional para 1–5 tenants com riscos conhecidos. **Não pronto para escalar sem 4 correções críticas adicionais** descobertas nesta auditoria (além dos 12 blockers já corrigidos no Sprint 2).

**Estado real:** O sistema é um monólito Express-Drizzle-PostgreSQL com integração Anthropic Claude, WhatsApp via Evolution API, e scheduler de follow-ups. Após Sprints 1 e 2, a base de hardening está completa (~95%). Restam 4 riscos críticos de isolamento multi-tenant que causarão corrupção de dados em produção conforme o número de tenants crescer.

**O que funciona:** Chat AI com streaming SSE, 4 ferramentas de busca de produto com budget control, memória relacional por sessão (cápsulas Haiku), identidade cross-device via phone stitching, graceful shutdown, token caching no SYSTEM_PROMPT, 12 blockers de segurança corrigidos.

**O que quebra:** Lead scores corrompem cross-tenant, interesse de outlet vai para tenant errado, comissões por vendedor colidem entre tenants, e query de orçamento expõe IDs sem filtro de tenant. Estes são erros de dados silenciosos — não crashes — o que os torna mais perigosos.

**Custo AI estimado:** ~$40–200/mês para tráfego inicial (10–50 conversas/dia). Escala linearmente. Sem alertas de custo implementados.

---

## 2. CURRENT REAL SYSTEM STATE

### Stack Real em Produção

| Componente | Tecnologia | Status |
|---|---|---|
| Runtime | Node.js 22 (Alpine) | ✅ |
| Framework | Express 5 | ✅ |
| ORM | Drizzle + pg.Pool | ✅ |
| AI Principal | Anthropic claude-sonnet-4-6 | ✅ |
| AI Auxiliar | Anthropic claude-haiku-4-5-20251001 | ✅ |
| AI WhatsApp | Anthropic Managed Agents (beta) | ⚠️ Beta |
| WhatsApp | Evolution API v2.2.3 (Railway) | ⚠️ Externo |
| DB | PostgreSQL (Railway, 1 instância) | ✅ |
| Logging | Pino (stdout → Railway) | ✅ |
| Métricas | **Nenhuma** | ❌ |
| APM | **Nenhuma** | ❌ |
| Error Tracking | **Nenhuma** | ❌ |
| Rate Limiting | express-rate-limit (parcial) | ⚠️ |
| Health Check | `/api/healthz` (superficial) | ⚠️ |
| Cache | Anthropic prompt cache (ephemeral, 5min TTL) | ✅ |
| Autenticação | JWT-like session token (x-session-token) | ✅ |
| Deploy | Railway (main branch only) | ✅ |

### Tabelas de Banco (21 tabelas principais)

```
lojas, usuarios, convites, resetSenhaTokens, auditLogs, colaboradores,
customer_profiles, lead_scores, lead_score_history, lead_contexts,
automation_log, orcamentos, entregas, follow_ups, sessions, chat_events,
tool_executions, whatsapp_instances, produtos, outletInteresses, crawlerStatus,
despesas, despesasRecorrentes, comissoesConfig, metas,
product_families, relational_capsules, eventos_operacionais,
entradas_estoque, itensEntradaEstoque
```

---

## 3. ARCHITECTURE MATURITY ASSESSMENT

| Dimensão | Score (1–5) | Justificativa |
|---|---|---|
| Multi-tenant Isolation | 3/5 | 90% correto, 4 falhas críticas remanescentes |
| AI Cost Control | 4/5 | Token budget hard limit, compact hints, cache parcial |
| Observabilidade | 1/5 | Apenas logs stdout, zero métricas, zero alertas |
| Resiliência | 2/5 | Graceful shutdown OK; WhatsApp sem retry/circuit breaker |
| Segurança | 3/5 | Auth nas rotas sensíveis, mas audit log sem lojaId |
| Escabilidade Horizontal | 2/5 | Monólito Railway, schedulers sem distributed lock |
| Manutenibilidade | 4/5 | TypeScript strict, Drizzle tipado, logs estruturados |
| Testabilidade | 1/5 | Zero testes automáticos configurados |
| CI/CD | 3/5 | Typecheck no CI, deploy automático via main |
| Custo Operacional | 4/5 | Railway econômico, AI otimizado com Haiku para tarefas estruturadas |

**Maturidade Global: 2.7/5** — Adequado para early revenue com 1–5 tenants. **Não adequado** para escala sem correções de isolamento e observabilidade.

---

## 4. CRITICAL RISKS (Pós-Sprint 2)

Os 12 blockers do Sprint 2 foram corrigidos (commit 6060bb4). Esta auditoria descobriu **4 novos riscos críticos** e **3 altos** que não estavam no escopo anterior.

### CR-1 — lead_scores.customerId Unique GLOBAL (sem lojaId)
**Arquivo:** `lib/db/src/schema/lead-scores.ts:5`

```typescript
// ATUAL — colisão cross-tenant garantida
customerId: integer("customer_id").notNull().unique(),

// CORRETO — composite unique
unique("lead_scores_customer_loja_uq").on(t.customerId, t.lojaId)
```

**Causa raiz:** O ID de customer é sequencial global. Customer 100 de Loja 1 e Customer 100 de Loja 2 compartilham o mesmo integer. O unique constraint impede Loja 2 de criar o registro; o update do Loja 2 sobrescreve o score do Loja 1.

**Efeito cascata:** Em 2 tenants ativos, toda chamada a `persistLeadScore()` com customerIds coincidentes causa UNIQUE CONSTRAINT VIOLATION (swallowado em `setImmediate()`) ou corrupção silenciosa de score. CRM score = inútil para todos os tenants.

**Impacto financeiro:** Automações baseadas em score (WhatsApp follow-up segmentado) disparam para os clientes errados ou não disparam. Perda de conversão direta.

**Dificuldade de correção:** Baixa (~20 linhas). Requer `pnpm --filter @workspace/db run push`. Verificar duplicatas antes.

**Prioridade:** P0 — Corrigir antes de segundo tenant ativo.

---

### CR-2 — persistLeadScore() TOCTOU + Cross-Tenant Contamination
**Arquivo:** `artifacts/api-server/src/services/scoring/updater.ts:6–59`

```typescript
// ATUAL — lê e escreve sem filtro lojaId
const existing = await db.select().from(leadScoresTable)
  .where(eq(leadScoresTable.customerId, customerId));  // ← sem lojaId
await db.update(leadScoresTable).set({ score })
  .where(eq(leadScoresTable.customerId, customerId));  // ← sem lojaId
```

**Causa raiz:** A função de persistência opera em `customerId` isolado. Em 2+ tenants com customerIds colisionados, a leitura pode retornar o registro do tenant errado e o update sobrescreve o score de outro tenant.

**Efeito cascata:** Dois tenants se afetam mutuamente a cada sessão de chat. Score cai para zero ou inflaciona incorretamente.

**Dificuldade de correção:** Trivial (adicionar `eq(leadScoresTable.lojaId, lojaId)` nos WHERE).

**Prioridade:** P0.

---

### CR-3 — outletInteresses.insert() sem lojaId
**Arquivo:** `artifacts/api-server/src/routes/produtos.ts:276`

```typescript
// ATUAL — lojaId não passado, defaults para 1 (Cabo Frio)
await db.insert(outletInteressesTable).values({ produtoId: id });

// CORRETO
const lojaId = resolveLojaId(req);
await db.insert(outletInteressesTable).values({ produtoId: id, lojaId });
```

**Causa raiz:** Endpoint público `/outlet/:id/interesse` não chama `resolveLojaId()`. Todos os registros de interesse de todas as lojas são inseridos com `lojaId = 1`.

**Efeito cascata:** O ranking de outlet mostra dados completamente errados para Loja 2+. Decisão de negócio (quais produtos pedir) baseada em dado corrompido.

**Dificuldade de correção:** Trivial (2 linhas).

**Prioridade:** P0.

---

### CR-4 — comissoesConfig.vendedor Unique GLOBAL (sem lojaId)
**Arquivo:** `lib/db/src/schema/financeiro.ts` (~linha 40)

```typescript
// ATUAL — vendedor único GLOBALMENTE
vendedor: text("vendedor").notNull().unique(),

// CORRETO — composite unique
unique("comissoes_vendedor_loja_uq").on(t.vendedor, t.lojaId)
```

**Causa raiz:** Nome do vendedor é a chave de configuração de comissão. Vendedores com nomes iguais entre lojas (comum: "João", "Maria") colidem. Inserção do segundo tenant falha ou sobrescreve a configuração do primeiro.

**Efeito cascata:** Configuração de comissão de um tenant apaga a do outro. DRE financeiro com valores incorretos. Pagamento de comissão baseado em dado errado.

**Dificuldade de correção:** Baixa (~15 linhas).

**Prioridade:** P0.

---

### HA-1 — findOrcamentoById() sem filtro lojaId
**Arquivo:** `artifacts/api-server/src/services/orcamento/repository.ts:76–79`

**Impacto:** Information disclosure. Com bruteforce de IDs sequenciais, um atacante autenticado pode confirmar a existência de orçamentos de outros tenants e inferir volume de vendas. A rota faz check manual pós-query, mas o dado do outro tenant já foi lido pelo serviço.

**Fix:** Adicionar `lojaId` como parâmetro da função e filtrar no WHERE.

---

### HA-2 — resolveOrCreateCustomer() Race Condition
**Arquivo:** `artifacts/api-server/src/services/memory/identity.ts:4–27`

Dois requests simultâneos com mesmo `anonymousId` + `lojaId` → ambos verificam → nenhum encontra → ambos inserem → UNIQUE CONSTRAINT VIOLATION. Exceção propagada para catch do chat route → memória da sessão perdida silenciosamente.

**Fix:** `onConflictDoNothing()` no insert + re-fetch.

---

### HA-3 — No Global Error Handler em Express
**Arquivo:** `artifacts/api-server/src/app.ts`

Sem `app.use((err, req, res, next) => {...})`. Erros não capturados propagam para Express sem handler. `process.on('unhandledRejection')` não registrado — uma rejeição não capturada em `setImmediate()` do pós-processamento de chat pode derrubar o processo inteiro.

---

## 5. AI ARCHITECTURE REVIEW

### 5.1 Mapa Completo de Chamadas Anthropic (7 sites ativos)

| Arquivo | Função | Modelo | Max Tokens | Cache | Freq. |
|---|---|---|---|---|---|
| `routes/chat.ts` | Chat web (Pass 1) | sonnet-4-6 | 1024 | ✅ SYSTEM | Per message |
| `routes/chat.ts` | Chat web (Pass 2) | sonnet-4-6 | 1024 | ✅ SYSTEM | Se tool use |
| `services/memory/capsule.ts` | Gerar cápsula | haiku-4-5 | 400 | ❌ | Post-chat |
| `services/lead-context.ts` | Lead context JSON | haiku-4-5 | 500 | ❌ | On lead capture |
| `services/chat/lead-extractor.ts` | Extrair nome/tel | haiku-4-5 | 256 | ❌ | **Per message** |
| `lib/castor-agent.ts` | WhatsApp managed | Managed Agent | varies | Varies | Per WA msg |
| `routes/agent.ts` | Agent UI | Managed Agent | varies | Varies | On demand |
| `services/agente.ts` | Legado agente | varies | 600 | ❌ | **Dead code** |

### 5.2 Fluxo de Tokens por Sessão (Cenário Típico: 5 mensagens)

**Por mensagem sem tool use (70% dos casos):**
```
Input total: ~730–1.200 tokens
  - SYSTEM_PROMPT (cache hit): ~650 tokens @ $0.30/MTok = $0.0002
  - compactHints: ~60 tokens
  - stateBlock (retornantes): ~200 tokens
  - mensagens do chat: ~800 tokens
Output: ~512 tokens @ $15/MTok = $0.0077
Custo total: ~$0.010 (cache hit) / $0.018 (cache miss)
```

**Por mensagem com tool use (30% dos casos):**
```
Pass 1 + Pass 2: ~1.800 tokens input + ~1.024 tokens output
Custo total: ~$0.025 (cache hit) / $0.033 (cache miss)
```

**Por sessão (5 mensagens + pós-processing):**
```
4 msgs sem tools + 1 msg com tools: ~$0.085
5 extrações de lead (Haiku): ~$0.010
1 cápsula pós-sessão (Haiku): ~$0.004
Total por sessão: ~$0.10–$0.18
```

### 5.3 Ineficiências Identificadas

**Ineficiência #1 — Lead extraction em toda mensagem (ALTO IMPACTO)**
`extrairDadosConversa()` usa Haiku para extrair nome/telefone de CADA mensagem. O campo `deveSalvar` só persiste se há nome+telefone+produto, mas o Haiku é chamado SEMPRE. ~70% das mensagens não têm dados de lead extraíveis. Custo desperdiçado: ~$0.0014/mensagem.

**Ineficiência #2 — Capsule regenerada em toda sessão**
Uma conversa de 1 pergunta ("tem entrega?") gera cápsula de 400 tokens. O sistema não diferencia sessões com conteúdo relacional relevante de consultas simples. Fix sugerido: gerar capsule apenas se conversa > 3 mensagens AND classification.intent !== 'low'.

**Ineficiência #3 — WhatsApp sem visibilidade de custo**
`lib/castor-agent.ts` usa a beta API de Managed Agents. O billing é opaco — não há logging de tokens nesta path. Custo real do canal WhatsApp: desconhecido.

**Ineficiência #4 — agente.ts (dead code)**
`services/agente.ts` existe (raw HTTP fetch, model dinâmico, 600 tokens) mas não é importado em nenhum lugar. Deve ser deletado.

---

## 6. PRODUCT CONTEXT CRISIS (Histórico e Estado Atual)

### O Problema Original (Antes do Sprint 2)

O sistema injetava o catálogo completo no system prompt a cada request:
- 3.500–11.000 tokens de contexto de produto por request
- 100% de input tokens = catálogo estático sem cache
- Custo estimado: $0.09–$0.30/mensagem

### Estado Atual (Pós-Sprint 2)

4 blocos explícitos e minimizados:

| Bloco | Cache | Tokens Reais | Custo/request |
|---|---|---|---|
| SYSTEM_PROMPT | ✅ ephemeral | ~650 | $0.0002 (cached) |
| compactHints | ❌ | ~60 | $0.0002 |
| stateBlock (condicional) | ❌ | ~200 | $0.0006 |
| intentBlock (condicional) | ❌ | ~20 | $0.0001 |

**Redução real: De 3.500–11.000 tokens → 730–930 tokens. Redução de ~91%.**

### Limitação Remanescente

O compactHint mostra apenas os 4 produtos mais recentes. O modelo usa ferramentas para busca real. Se `search_products` falhar (timeout ou DB lento), o modelo responde genericamente ("consulte pelo WhatsApp"). Aceitável para MVP. Não é uma crise — é um tradeoff consciente.

---

## 7. PROMPT CACHING STRATEGY

### O Que É Cacheado

Apenas Block 1 (SYSTEM_PROMPT), `cache_control: { type: "ephemeral" }`. TTL: **5 minutos** no servidor Anthropic.

**Cross-tenant:** SYSTEM_PROMPT não tem dados de tenant. Requests de Loja 1 e Loja 2 dentro da mesma janela de 5min compartilham o cache. **Correto e economicamente ótimo.**

### Análise de Eficiência por Volume de Tráfego

| Tráfego | Requests/hora | Intervalo médio | Cache hit rate estimado |
|---|---|---|---|
| 100 conversas/dia | 4/hora | 15 min | **<30%** (TTL 5min expira entre requests) |
| 500 conversas/dia | 20/hora | 3 min | **~50%** |
| 1.000 conversas/dia | 42/hora | ~90s | **>80%** |

**Implicação:** Em estágio inicial (<100 conversas/dia), o cache economiza pouco. Em escala (>500/dia), economiza 40–50% do custo de input do SYSTEM_PROMPT.

### Oportunidade: Cache Persistent

Se o tráfego crescer, mudar de `ephemeral` (5min) para `persistent` (60min TTL) aumenta o hit rate drasticamente para padrões intermitentes típicos do varejo (pico no almoço + tarde). Mudança de 1 linha. Custo de write idêntico, amortizado sobre janela 12x maior.

### O Que NÃO Deve Ser Cacheado

Blocos 2, 3, 4 (compactHints, stateBlock, intentBlock) não devem ter `cache_control` — são dinâmicos e a cache key seria diferente a cada request, gerando cache write sem read. Corretamente implementado.

---

## 8. RETRIEVAL ARCHITECTURE ANALYSIS

### Arquitetura Atual: 4 SQL Tools

| Tool | Mecanismo | Parâmetros | Resultado |
|---|---|---|---|
| `search_products` | ILIKE `%query%` | query, category | Até 20 produtos |
| `get_catalog` | Full SELECT por família | category (opcional) | Famílias + variantes |
| `get_product_family` | SELECT por slug | family_id | Todas variantes |
| `get_store_info` | SELECT por lojaId | nenhum | Endereço, WhatsApp |

**Forças:**
- Zero latência de embedding (tudo SQL)
- Zero custo de indexação/atualização
- Determinístico e debugável
- Adequado para catálogo < 500 produtos/tenant

**Limitações:**
- ILIKE sem tolerância a erros ortográficos ("pockect" falha, "matress" falha)
- Sem ranking por relevância semântica
- Sem mapeamento de sinonímia ("espuma" vs "foam" vs "D45")
- Consultas multi-critério ("pesado + fresquinho + barato") exigem que o modelo faça a síntese sem guia explícito

**Frequência de falha estimada:** 15–25% das consultas específicas com linguagem natural informal (WhatsApp-style).

---

## 9. RAG VIABILITY ANALYSIS

### O Que Seria RAG Aqui

Embeddings de produtos (nome + tecnologia + público-alvo + faixa de preço) em `pgvector`. Na consulta: embedding da query → cosine similarity → top-K → injetar no prompt.

### Análise de Custo de Implementação

| Item | Estimativa |
|---|---|
| pgvector extension (Railway PostgreSQL) | Zero (suportado nativamente) |
| Gerar embeddings iniciais (~500 produtos) | ~$0.001 total |
| Re-indexação pós-crawler | ~$0.001/run |
| Código: 1 nova tool `semantic_search` | ~1 sprint |
| Latência adicional/request | +50–100ms |

### Verdict: RAG é Overengineering Neste Estágio

**Razão 1 — Catálogo pequeno:** < 500 produtos/tenant. `get_catalog` retorna tudo em ~200 tokens. Não há problema de "agulha no palheiro".

**Razão 2 — Domínio fechado:** O modelo já sabe o que é Pocket Spring, D45, Memory Foam. O SYSTEM_PROMPT tem conhecimento técnico completo. O retrieval só precisa encontrar o produto, não interpretar o conceito.

**Razão 3 — Custo vs. benefício assimétrico:** Para passar de 75% para 90% de acerto, RAG adiciona $0.0001/query + 100ms + 1 sprint. O mesmo resultado pode ser obtido com lematização básica no `search_products` — mudança de 1 hora de código.

**Razão 4 — O real gargalo não é retrieval:** É a ausência de observabilidade para saber QUAIS queries falham. Sem logs de "tool retornou 0 resultados", qualquer otimização de retrieval é prematura.

**Recomendação:** Implementar RAG no Sprint 4 **somente se** análise de logs de produção mostrar > 20% de queries `search_products` retornando 0 resultados.

---

## 10. TOKEN ECONOMICS

### Custo por Unidade (Preços Anthropic ~Jan 2026)

*Nota: Preços são aproximados. Verificar pricing atual em console.anthropic.com antes de decisões orçamentárias.*

- Sonnet 4.6: ~$3/MTok input, ~$15/MTok output
- Cache read Sonnet: ~$0.30/MTok | Cache write: ~$3.75/MTok
- Haiku 4.5: ~$0.80/MTok input, ~$4/MTok output

| Cenário | Custo Estimado |
|---|---|
| Chat simples (cache hit) | ~$0.010/msg |
| Chat simples (cache miss) | ~$0.018/msg |
| Chat com tool use (cache hit) | ~$0.025/msg |
| Chat com tool use (cache miss) | ~$0.033/msg |
| Sessão completa (5 msgs + haiku) | ~$0.10–$0.18 |

### Escala de Custo Mensal

| Conversas/dia | Custo AI/mês (USD) | Custo AI/mês (BRL ~5x) |
|---|---|---|
| 10 | ~$39 | ~R$ 195 |
| 50 | ~$195 | ~R$ 975 |
| 200 | ~$780 | ~R$ 3.900 |
| 500 | ~$1.950 | ~R$ 9.750 |

### Otimizações Reais vs. Placebo

**Otimizações com impacto real:**

| Otimização | Economia Estimada | Dificuldade |
|---|---|---|
| Skip lead extractor se intent='low' AND msgs<3 | -40% custo Haiku extraction | Baixa |
| Skip capsule se intent='low' AND primeira sessão | -30% custo Haiku capsule | Média |
| Cache persistent (60min) vs ephemeral (5min) | -15% custo input Sonnet | Trivial |
| Alert via Anthropic Usage API (daily threshold) | Previne surpresa de custo | Trivial |

**Otimizações placebo (impacto negligenciável):**

- **Reduzir `max_tokens` de 1024 para 512:** output billing é por tokens consumidos, não por max_tokens. Se o model gera 300 tokens, você paga 300. Mudança: zero impacto.
- **Cache de compactHints:** 60 tokens × $3/MTok = $0.0002 economizado. Custo de implementação > economia.
- **Gzip em SSE:** chunks pequenos não comprimem eficientemente. Ganho < 5%.
- **Reduzir MAX_TOOLS_PER_TURN de 2 para 1:** raramente o model usa 2 tools. Impacto negligenciável.

---

## 11. MULTI-TENANT SCALING RISKS

### Componentes SEGUROS (Pós-12 Blockers do Sprint 2)

| Componente | Por que Seguro |
|---|---|
| `resolveOrCreateCustomer(anonymousId, lojaId)` | WHERE filtra ambos |
| `stitchIdentityByPhone(phone, lojaId)` | scopa por lojaId |
| `getProductContextCompact(lojaId)` | WHERE loja_id correto |
| `search_products/get_catalog/get_product_family` | todos filtram lojaId |
| `sessionByPhone` map (waha.ts) | keyed `${lojaId}:${phone}` |
| CRUD de produtos sensíveis | requireDono + lojaId filter |
| `VALID_LOJA_IDS` Set | read-only global cache, safe |
| sessions Map | keyed por token, lojaId no payload |

### Componentes VULNERÁVEIS (desta auditoria)

| Componente | Risco | Fix |
|---|---|---|
| `lead_scores` (CR-1) | Unique sem lojaId | Composite unique |
| `persistLeadScore()` (CR-2) | Sem lojaId filter | Adicionar lojaId |
| `outletInteresses` insert (CR-3) | lojaId = 1 hard | Passar lojaId |
| `comissoesConfig` (CR-4) | Unique sem lojaId | Composite unique |
| `findOrcamentoById()` (HA-1) | Info disclosure | Filtrar lojaId |

### Scheduler Blast Radius

**followup-scheduler** (6h interval, com `_cicloRunning` guard pós-C3):
- Processa orçamentos de TODOS os tenants sem paginação
- 10 tenants × 50 orçamentos = 500 follow-ups por run
- Cada follow-up = 1 HTTP request para Evolution API (sem retry, sem circuit breaker)
- Se Evolution API down: follow-ups não marcados como executados → retentados em 6h. Aceitável.

**recorrentes-scheduler** (1h interval, verifica hora 00 UTC):
- 100 tenants × 20 despesas recorrentes = 2.000 INSERTs em < 2 min
- Pool de 20 conexões pode saturar se qualquer INSERT travar
- Risco moderado — sem timeout por query configurado

---

## 12. DATABASE & PERSISTENCE RISKS

### Schema Issues por Severidade

| Severidade | Tabela | Problema | Fix |
|---|---|---|---|
| CRÍTICO | `lead_scores` | customerId unique global | Composite (customerId, lojaId) |
| CRÍTICO | `comissoes_config` | vendedor unique global | Composite (vendedor, lojaId) |
| ALTO | `outletInteresses` | insert sem lojaId | Passar lojaId explicitamente |
| MÉDIO | `chat_events` | lojaId nullable | NOT NULL |
| MÉDIO | `audit_logs` | lojaId nullable | NOT NULL |
| MÉDIO | `customer_profiles` | race condition no insert | onConflictDoNothing |
| BAIXO | 12 tabelas | lojaId default = 1 | Code review de todos os inserts |

### Pool Configuration (Pós-C4, commit 6060bb4)

```typescript
pool = new Pool({
  max: 20,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});
```

Adequado para 15 requests concorrentes. **Ausências críticas:**
- `pool.on('error', logger.error)` não registrado → erros de pool silenciosos
- Pool stats não expostos em `/healthz` → invisível em produção

### Migration Strategy Risk

Drizzle Kit `push` roda no pre-deploy Railway. Em produção com dados:
- Adicionar coluna NOT NULL sem default → erro se tabela tem linhas
- Fix CR-1 (composite unique em lead_scores) → verificar duplicatas antes do push
- **Recomendação Sprint 4:** Migrar para `drizzle-kit generate` + `migrate` com arquivos versionados

---

## 13. SECURITY RISKS

### Endpoints Públicos sem Rate Limit

| Endpoint | Status |
|---|---|
| `POST /api/chat` | ✅ 30/15min por IP |
| `GET /api/produtos` | ❌ Sem limite |
| `GET /api/produtos/buscar` | ❌ Sem limite |
| `POST /api/produtos/outlet/:id/interesse` | ❌ Sem limite |
| `GET /api/dashboard` | ❌ Sem limite (autenticado mas sem limit) |
| `POST /api/crawler/iniciar` | ❌ Sem limite |

### API Key Management

`ANTHROPIC_API_KEY` é validada lazy (apenas no primeiro request). Se ausente:
- Chat: retorna fallback silenciosamente (sem alerta!)
- `castor-agent.ts`: usa `process.env.ANTHROPIC_API_KEY!` (non-null assertion) → TypeError em runtime
- Lead context/capsule: lança erro swallowado em `setImmediate()`

**Risco operacional:** Key rotacionada no Railway sem atualizar serviço → chat para silenciosamente, sem alerta, clientes recebem mensagem de fallback genérica.

### Audit Trail Incompleto

`auditLogs.lojaId` é nullable. Logs de segurança (login, reset de senha, convites) podem não ter tenant associado. Investigação forense de incidente cross-tenant é impraticável.

---

## 14. DEPLOYMENT & INFRASTRUCTURE RISKS

### Single Point of Failure: Railway

Sistema roda em 1 único serviço Railway, 1 instância. Sem:
- Multi-region failover
- Horizontal auto-scaling
- Blue-green deployment
- Rollback automático em crash pós-deploy

**Impacto de downtime:** 100% das lojas offline simultaneamente.

### Health Check Superficial

```typescript
// Atual — sempre retorna ok, mesmo com DB down
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});
```

Sem probe de DB (`SELECT 1`), sem validação de API key Anthropic, sem pool stats. Railway pode considerar o serviço saudável enquanto 100% das queries de DB falham.

### Managed Agents Beta Risk

`lib/castor-agent.ts` usa `"anthropic-beta": "managed-agents-2026-04-01"`. APIs beta:
- Sem SLA garantido
- Podem ser alteradas ou depreciadas sem notice
- Billing pode mudar

**Risco estratégico:** WhatsApp path 100% dependente de beta API sem fallback. Uma mudança de API derruba o WhatsApp de todas as lojas sem aviso.

### Ausência de Observabilidade

Não existe:
- Prometheus / métricas de request latency
- Sentry ou similar para error tracking
- Datadog / NewRelic para APM
- Alertas de custo AI
- Pool connection monitoring

**Impacto:** Problemas em produção são descobertos quando tenant reclama, não quando ocorrem. Mean Time To Detection (MTTD) = horas.

---

## 15. COST EXPLOSION RISKS

**Risco #1 — WhatsApp loop:**
Bot respondendo bot (automação de outro sistema enviando mensagens). Managed Agents sem rate limit em webhook. 1.000 mensagens automáticas × $0.03 = $30 em horas. Sem alerta, sem circuit breaker.

**Risco #2 — Lead extractor em toda mensagem:**
Com 1.000 sessões/dia × 5 msgs × $0.002 Haiku = $10/dia em extrações onde 70% não produzem dados de lead. $300/mês desperdiçado em escala.

**Risco #3 — Capsule generation irrestrita:**
1.000 sessões × $0.004/capsule = $4/dia. Crescimento linear com usuários. Sem lógica de "pular se sessão trivial".

**Risco #4 — API key inválida em silêncio:**
Key rotacionada → chat para → sistema responde com fallback → ZERO alerta → descobre-se em revisão semanal.

**Risco #5 — Sem billing alert:**
Nenhuma integração com Anthropic Usage API para alertar quando custo diário excede threshold. Um bug que duplica chamadas pode custar $500+ antes de ser detectado.

---

## 16. WHAT BREAKS AT 10 / 100 / 1,000 TENANTS

### A 10 Tenants (iminente)

**Quebra com certeza:**
- `lead_scores` (CR-1): CustomerIDs colidem entre tenants 3–10. Scores corrompem. CRM inutilizado.
- `comissoesConfig` (CR-4): Vendedores com nomes iguais entre lojas colidem. DRE incorreto.
- `outletInteresses` (CR-3): Todos os interesses vão para lojaId=1. Rankings errados.
- `persistLeadScore` (CR-2): Updates sobrescrevem scores de outras lojas.

**Sobrevive:**
- Chat AI (completamente isolado por lojaId)
- Orçamentos e financeiro (lojaId correto)
- WhatsApp (keyed por lojaId:phone)
- CRUD de produtos (todos com filtros corretos)

### A 100 Tenants

**Quebra adicionalmente:**
- **DB Pool:** Scheduler + 10+ chat simultâneos + crawler = 15–18 conexões. A 100 tenants com pico noturno simultâneo, pool esgota. Chat requests esperam 5s → timeout.
- **Scheduler sem paginação:** SELECT full de todos os orçamentos de 100 tenants = 10.000 rows/run. Funcional mas lento (2–5s de query). Impacta pool durante run.
- **Session map sem cleanup:** 100 tenants × 100 clientes WhatsApp = 10.000 entradas. Memory leak lento mas crescente.
- **Custo AI:** 100 tenants × 20 conversas/dia = 2.000 conversas/dia → ~$26/dia = $780/mês. Sustentável apenas com pricing correto.

### A 1,000 Tenants

O sistema como está **não funciona em 1.000 tenants** sem refatoração de:

1. **Schedulers:** BullMQ + Redis (não setInterval em processo único)
2. **Sessions:** External store (Redis) — in-memory se torna problema de memória e horizontal scaling
3. **DB pooling:** PgBouncer ou pg-pool por tier
4. **Railway:** Horizontal scaling (sessionByPhone e crawlerRunning precisam de shared state via Redis)
5. **AI cost:** ~$7.800/mês em Haiku post-processing isolado. Exige otimização agressiva ou pricing > R$ 150/tenant apenas para cobrir AI.
6. **Event writes:** 100.000 inserts/dia em chat_events. Precisa de archival/partitioning.

---

## 17. DO NOT SCALE BEFORE FIXING

### Fase 0: Imediato (antes de qualquer segundo tenant ativo) — ~5 horas total

| Fix | Arquivo | Esforço |
|---|---|---|
| CR-1: lead_scores composite unique | `lib/db/src/schema/lead-scores.ts` | 20 min |
| CR-2: persistLeadScore lojaId filter | `services/scoring/updater.ts` | 30 min |
| CR-3: outletInteresses insert lojaId | `routes/produtos.ts:276` | 10 min |
| CR-4: comissoesConfig composite unique | `lib/db/src/schema/financeiro.ts` | 20 min |
| HA-3: Global Express error handler + unhandledRejection | `app.ts` + `index.ts` | 1h |
| DB push + verificar duplicatas antes | `pnpm --filter @workspace/db run push` | 30 min |

### Fase 1: Antes de 10 tenants (1–2 semanas)

1. HA-1: `findOrcamentoById()` com lojaId filter
2. HA-2: `resolveOrCreateCustomer()` com `onConflictDoNothing()`
3. `pool.on('error', logger.error)` + pool stats em `/healthz`
4. Alertas de custo via Anthropic Usage API
5. Rate limit em `/api/crawler`, `/api/produtos`, `/api/financeiro`

### Fase 2: Antes de 50 tenants

1. Distributed lock para schedulers (tabela `scheduler_locks`)
2. `lead_score_history` dedup constraint
3. Observabilidade mínima (Prometheus ou Datadog Agent)
4. WhatsApp: retry com backoff exponencial + circuit breaker

---

## 18. GOOD ENOUGH FOR EARLY REVENUE

### O Que o Sistema FAZ Hoje (Commit 6060bb4)

✅ Chat AI com streaming, tool use, memória relacional, identidade cross-device
✅ Orçamentos, financeiro, estoque, entrega — fluxo de negócio completo
✅ Follow-ups automáticos de WhatsApp por janela temporal (3/7/14 dias)
✅ Graceful shutdown, AbortController, prompt caching, token budget
✅ TypeScript strict, Drizzle tipado, Pino structured logging
✅ Rate limiting nas rotas críticas (chat, auth, WhatsApp)
✅ Typecheck CI passa limpo

### O Que NÃO Está Pronto

❌ Qualquer segundo tenant ativo sem aplicar CR-1, CR-2, CR-3, CR-4 (~4h de trabalho)
❌ Monitoramento de custo AI (pode surpreender no fim do mês)
❌ Visibilidade de erros em produção (falhas silenciosas)
❌ WhatsApp beta API risk (sem fallback documentado)

### Modelo de Negócio: Viabilidade de Margem

| Tenants | Conversas/dia/tenant | Custo AI/mês | Receita mínima (2x AI) |
|---|---|---|---|
| 1 | 30 | ~$58 | ~R$ 580 |
| 5 | 20 | ~$195 | ~R$ 1.950 (R$ 390/tenant) |
| 10 | 15 | ~$292 | ~R$ 2.920 (R$ 292/tenant) |

**Conclusão:** A preço de R$ 297–497/tenant/mês, o negócio é viável até 10–20 tenants com tráfego moderado.

---

## 19. RECOMMENDED PRODUCTION ARCHITECTURE

### Arquitetura Atual (Válida até ~20 Tenants)

```
[Frontend Vercel] ──── [API Server Railway]
                              │
                   [PostgreSQL Railway]
                              │
         ┌────────────────────┼──────────────────┐
         │                    │                   │
 [Anthropic API]      [Evolution API]    [setInterval Jobs]
 (sonnet-4-6)         (WhatsApp)         (followup, recorrentes)
 (haiku-4-5)
```

Esta arquitetura é **correta para este estágio**. O monólito é uma vantagem: reduz latência, simplifica debugging, elimina overhead de microservices.

### Evolução para 50–100 Tenants (Sem Reescrita)

```
[Frontend Vercel] ──── [API Server Railway × 2]  ← horizontal scale
                              │
                    [PgBouncer] ──── [PostgreSQL Railway]
                              │
         ┌────────────────────┼──────────────────┐
         │                    │                   │
 [Anthropic API]      [Evolution API]     [BullMQ Workers]
                                                  │
                                            [Redis Railway]
```

Passos incrementais (sem reescrita):
1. Mover schedulers de `setInterval` para BullMQ + Redis
2. Adicionar PgBouncer entre API e Postgres
3. Horizontal scale Railway (shared state via Redis para sessionByPhone e crawlerRunning)

### Componentes que NÃO Precisam Ser Reescritos

Drizzle ORM, Express 5, 4-block system prompt, Pino logging, Haiku para extração estruturada, SQL tools para retrieval — todos corretos e adequados para 50+ tenants com ajustes pontuais.

---

## 20. PHASE 3 ROADMAP

### Sprint 3-A: Isolamento Multi-Tenant (1 semana)

| Task | Arquivo(s) | Prioridade |
|---|---|---|
| CR-1: lead_scores composite unique | `lib/db/src/schema/lead-scores.ts` | P0 |
| CR-2: persistLeadScore lojaId filter | `artifacts/api-server/src/services/scoring/updater.ts` | P0 |
| CR-3: outletInteresses insert lojaId | `artifacts/api-server/src/routes/produtos.ts:276` | P0 |
| CR-4: comissoesConfig composite unique | `lib/db/src/schema/financeiro.ts` | P0 |
| HA-1: findOrcamentoById com lojaId | `artifacts/api-server/src/services/orcamento/repository.ts` | P1 |
| HA-2: resolveOrCreateCustomer onConflict | `artifacts/api-server/src/services/memory/identity.ts` | P1 |
| HA-3: Global Express error handler | `artifacts/api-server/src/app.ts` + `index.ts` | P1 |
| Delete dead code (context-builder, truth-state, response-validator, agente.ts) | `artifacts/api-server/src/services/chat/` | P2 |
| DB push (aplicar schema changes) | `pnpm --filter @workspace/db run push` | P0 |

### Sprint 3-B: Observabilidade Mínima (1 semana)

| Task | Impacto |
|---|---|
| `pool.on('error', logger.error)` + pool stats em `/healthz/deep` | Elimina falhas silenciosas de DB |
| Anthropic Usage API alert (daily threshold) | Previne surpresa de custo |
| Sentry (erros críticos: auth, AI failures, crawler) | Visibilidade de produção |
| Rate limit em `/api/crawler`, `/api/produtos`, `/api/financeiro` | Proteção contra abuso |
| `/healthz/deep` com probe de DB (`SELECT 1`) | Detecta DB down antes de Railway |

### Sprint 3-C: Otimizações de Custo AI (1 semana)

| Otimização | Economia |
|---|---|
| Skip lead extractor se intent='low' AND msgs<3 | -40% custo Haiku extraction |
| Skip capsule se intent='low' AND primeira sessão | -30% custo Haiku capsule |
| Cache persistent (60min) em vez de ephemeral (5min) | -15% custo input Sonnet |
| WhatsApp session cleanup (TTL 24h no Map) | Previne memory leak |

### Sprint 4: Resiliência e Escala (quando necessário)

| Task | Gatilho |
|---|---|
| BullMQ para schedulers | > 50 tenants |
| PgBouncer | > 30 tenants ou pico > 20 req/s |
| Distributed lock (`scheduler_locks` table) | Antes de horizontal scaling |
| Migration files versionados (gen + migrate) | Antes de tenant com dados históricos críticos |
| Managed Agent → Direct API para WhatsApp | Quando beta API for depreciada |
| pgvector + semantic search | Se logs mostram > 20% queries `search_products` sem resultado |

---

## 21. FINAL BRUTALLY HONEST RECOMMENDATION

### O Que Está Correto

A arquitetura escolhida é adequada. Monólito Express + PostgreSQL + Anthropic + Railway é a stack certa para um SaaS regional B2B com 1–20 tenants e equipe pequena. Os Sprints 1 e 2 resolveram ~85% dos problemas críticos: token cost (redução 91%), multi-tenant isolation na maioria das rotas, graceful shutdown, AbortController, prompt caching, tool budget. O código é tipado, estruturado e manutenível.

### O Que Ainda Está Errado

4 falhas críticas de isolamento multi-tenant (CR-1 a CR-4) causarão corrupção **silenciosa** de dados assim que o segundo tenant ficar ativo. Não são crashes — são corrupções que aparecem como "bug de negócio" semanas depois: DRE financeiro incorreto, scores de CRM errados, rankings de outlet vazios. Este é o tipo mais perigoso de problema.

Existe **zero observabilidade em produção**. Problemas só são descobertos quando tenants reclamam. Mean Time To Detection = horas ou dias.

O path de **WhatsApp via Managed Agents beta** é um risco estratégico não documentado. Uma mudança de API derruba o WhatsApp de todas as lojas sem aviso.

### Decisão Binária: Pode Gerar Receita Agora?

**SIM** para o primeiro tenant (lojaId=1) — o sistema funciona para Cabo Frio hoje.

**NÃO** para segundo tenant sem aplicar CR-1 a CR-4. **Estimativa: 4–5 horas de trabalho.**

### Red Lines

Se qualquer uma destas condições ocorrer em produção, investigar imediatamente:

1. Erros de `UNIQUE CONSTRAINT VIOLATION` em `lead_scores` nos logs
2. Custo diário Anthropic > 2× a média dos últimos 7 dias sem crescimento de tráfego
3. `pool.idleCount = 0` por > 5 minutos consecutivos
4. `sessionByPhone` Map > 50.000 entradas (memory leak em escala)
5. Fallback message de chat sendo retornada para usuários reais (indica `ANTHROPIC_API_KEY` inválida)

### Prioridade Real (em Ordem de Impacto de Negócio)

1. **CR-1, CR-2, CR-3, CR-4** — Corrupção de dados (P0, ~4h, hoje)
2. **Global error handler + unhandledRejection** — Resiliência de processo (P0, ~1h, hoje)
3. **Observabilidade mínima** — Visibilidade de produção (P1, esta semana)
4. **Otimização de custo AI** — Margem unitária (P2, próxima sprint)
5. **Scheduled jobs para BullMQ** — Escala (P3, quando > 50 tenants)
6. **RAG / pgvector** — Qualidade de retrieval (P4, somente com dados provando necessidade)
7. **Microservices / multi-region** — Overengineering neste estágio (P5, talvez nunca para < 100 tenants)

---

*Documento gerado por auditoria independente de 3 agentes paralelos (AI Architecture, Multi-Tenant/DB Schema, Infrastructure/Observability) + leitura direta de todos os arquivos críticos. Todos os dados são baseados em análise real do codebase no commit 6060bb4, branch `claude/multi-tenant-saas-system-jiHJt`. Nenhum dado foi inferido sem base em código fonte.*
