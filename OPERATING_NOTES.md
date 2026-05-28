# OPERATING NOTES — POST SPRINT 3-D
<!-- updated: 2026-05-28 | branch: claude/multi-tenant-saas-system-jiHJt -->

## Contexto atual da plataforma

A base do Castor SaaS evoluiu para um estágio de MVP multi-tenant operacional, com os principais riscos estruturais já tratados e com uma camada mínima de observabilidade em funcionamento.

**O que já existe hoje no sistema:**
- Isolamento cross-tenant estabilizado em pontos críticos (Sprint 3-A: CR-1 a CR-4, HA-1 a HA-3)
- Custo de IA mensurável em runtime (`event=session_complete` com `estimatedCostUsd`)
- Schedulers com métricas estruturadas (durationMs, geradas, enviados)
- WAHA com falhas HTTP detectáveis (status code logado)
- Pool de banco com sinalização de pressão (`waitingCount > 0` a cada 30s)
- Healthcheck útil para operação (`/healthz/deep` com `SELECT 1` + pool stats)
- Telemetria básica via stdout → Railway logs (Pino estruturado)

---

## Leitura do estágio atual

Neste momento, o maior valor vem de:
- Operar com visibilidade — entender o que acontece antes de mudar
- Preservar isolamento multi-tenant — nunca relaxar essa garantia
- Medir custo e comportamento real — deixar os logs provarem o gargalo
- Observar saturação antes de expandir complexidade
- Consolidar confiança operacional antes de escalar arquitetura

---

## Direção arquitetural preferida

A tendência geral deste estágio é continuar fortalecendo a plataforma com soluções proporcionais ao volume real de uso. Quando surgirem evidências concretas de gargalo, vale considerar evoluções como:

- Melhor agregação de telemetria (dashboards Railway ou Datadog Agent simples)
- Alertas por limiar de custo AI (Anthropic Usage API polling diário)
- Dashboards operacionais por tenant
- Maior resiliência dos schedulers (BullMQ + Redis quando > 50 tenants)
- Estratégias mais robustas para WhatsApp (retry com backoff, circuit breaker)
- Persistência compartilhada para estados voláteis (Redis para `sessionByPhone` se horizontal scale)
- Filas e workers dedicados quando a carga justificar
- Evolução para retrieval mais sofisticado (pgvector) **apenas se** logs mostrarem > 20% de queries `search_products` sem resultado

---

## Critérios de decisão que ajudam a manter a arquitetura saudável

A prioridade tende a ser:
1. Preservar integridade de dados (isolamento multi-tenant é não-negociável)
2. Preservar visibilidade operacional (se não é observável, não vai para prod)
3. Preservar custo unitário saudável (AI cost por sessão deve ser mensurável)
4. Evitar complexidade prematura (sem abstração sem evidência concreta de necessidade)
5. Expandir apenas quando houver sinal claro de benefício (logs, não hipóteses)

Quando houver dúvidas entre duas abordagens, a opção mais forte costuma ser a que:
- Mantém o sistema observável
- Reduz risco de corrupção silenciosa
- Conserva simplicidade operacional
- Melhora margem sem criar acoplamento desnecessário

---

## Validação de dados antes de mudanças de banco

Antes de qualquer alteração que afete constraints, chaves únicas ou comportamento multi-tenant, **validar o estado real do banco no Railway Postgres** e confirmar se os dados existentes já estão consistentes com o modelo esperado.

```sql
-- Exemplo: antes de aplicar composite unique em lead_scores (Sprint 3-A)
SELECT customer_id, loja_id, COUNT(*)
FROM lead_scores
GROUP BY customer_id, loja_id
HAVING COUNT(*) > 1;

-- Exemplo: antes de aplicar composite unique em comissoes_config
SELECT vendedor, loja_id, COUNT(*)
FROM comissoes_config
GROUP BY vendedor, loja_id
HAVING COUNT(*) > 1;
```

Se retornar linhas → limpar duplicatas primeiro, depois `pnpm --filter @workspace/db run push`.

---

## Próximos focos naturais da plataforma

A próxima fase de maturidade do sistema tende a concentrar-se em:
- **Telemetry aggregation** — agrupar `session_complete` por tenant para custo diário
- **Thresholds e alertas** — custo > X/dia → log warning ou notificação
- **Analytics por tenant** — sessões, conversão, score médio por lojaId
- **Resiliência dos schedulers** — retry individual de follow-ups, não abortando o ciclo inteiro
- **Confiabilidade do canal WhatsApp** — backoff exponencial, circuit breaker para Evolution API
- **Governança de custo de IA** — skip de capsule/extraction com critérios mais refinados
- **Leitura mais fina de capacidade** — pool `waitingCount` correlacionado com latência de resposta

---

## O que NÃO pertence a este sistema no estágio atual

| Tecnologia | Motivo para não adotar agora |
|---|---|
| RAG / pgvector | Sem evidência de falha de retrieval > 20% |
| BullMQ + Redis | Schedulers corretos com `setInterval` até ~50 tenants |
| Microservices / multi-region | Monólito Railway é a arquitetura correta hoje |
| LangChain / orquestração | SDK Anthropic direto é mais simples e barato |
| Sentry / Datadog | Defer até Railway logs mostrarem insuficiência |
| Cache `persistent` | Aguardar `@anthropic-ai/sdk` > 0.90.0 com `CacheControlPersistent` |

---

## Estado do sistema pós-Sprints 1–3D

| Dimensão | Estado |
|---|---|
| Multi-tenant isolation | ✅ Estabilizado (Sprint 3-A) |
| AI cost visibility | ✅ `session_complete` log por sessão |
| Pool observability | ✅ Error listener + pressure warning + healthz/deep |
| Rate limiting | ✅ Chat, auth, crawler, produtos, financeiro, dashboard |
| Scheduler telemetry | ✅ durationMs + geradas/enviados estruturados |
| WAHA failures | ✅ HTTP errors detectados |
| Global error handler | ✅ Express 4-arg + unhandledRejection |
| Cache strategy | ✅ ephemeral em SYSTEM_PROMPT (persistent: aguardar SDK) |
| Haiku cost optimization | ✅ Skip para intent=low |
| WhatsApp session TTL | ✅ 24h com cleanup horário |
| Dead code | ✅ 9 arquivos removidos |
| Observabilidade APM | ❌ Deferred — Railway logs suficientes agora |
| Sentry | ❌ Deferred |
| BullMQ schedulers | ❌ Deferred (>50 tenants) |
| Cache persistent | ❌ Aguardar SDK upgrade |

---

*Documento atualizado pós-Sprint 3-D. Para detalhes técnicos dos risks e roadmap completo, ver `PHASE_3_MASTER_ENGINEERING_REVIEW.md`.*
