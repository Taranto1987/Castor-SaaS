# Auditoria operacional real — Castor SaaS — 2026-05-28

## Escopo e método

Esta auditoria verificou o estado concreto do repositório local em `/workspace/Castor-SaaS`, do Git disponível no container, dos arquivos presentes no filesystem, dos comandos executáveis localmente e de uma tentativa de acesso HTTP ao endpoint de deploy indicado nos manifests.

Regra usada: quando não houve evidência verificável em código, commit, arquivo, runtime local, log local ou endpoint externo acessível, o item foi marcado como **NÃO VERIFICADO**.

## Comandos executados

- `find .. -name AGENTS.md -print`
- `git status --short --branch`
- `git log --oneline --decorate --max-count=30`
- `git branch -vv`
- `git remote -v`
- `git show --stat --name-only --format=fuller b4c2245 --`
- `git diff-tree --no-commit-id --name-status -r <commit>` para os 10 commits mais recentes
- `find . -maxdepth 3 -name package.json -print -o -name vercel.json -print -o -name railway.json -print -o -name .env.example -print -o -name '.env*' -print`
- `rg -n "env-validator|scheduler-stabilization|observabilidade|observability|healthz|deep|assertTenantOwnership|TenantContext|tenant|loja_id|migration|lock|scheduler|Anthropic|anthropic|AI usage|usage|correlation|requestId|request-id|x-request|neon|Evolution|EVOLUTION|WAHA|DATABASE_URL|BOOT|boot" artifacts/api-server lib scripts package.json railway.json .env.example -g '!**/dist/**' -g '!**/node_modules/**'`
- `find . -path './node_modules' -prune -o -path './.git' -prune -o \( -iname '*env*validator*' -o -iname '*scheduler*stabilization*' -o -iname '*observabilidade*' -o -iname '*observability*' \) -print`
- `rg -n "function assertTenantOwnership|assertTenantOwnership|withTenant|TenantContext|AsyncLocalStorage|migration validation|validate.*migration|schema.*startup|drizzle.*push|pg_advisory|advisory|onConflictDoNothing|uniqueIndex|lojaId.*notNull|loja_id" artifacts/api-server lib scripts -g '!**/dist/**'`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm --filter @workspace/api-server run build`
- `node -e` para checar presença/ausência de variáveis de ambiente sem revelar valores
- `pnpm --filter @workspace/api-server start`
- `curl -sS -m 15 -D - https://evolution-api-production-405f.up.railway.app/api/healthz`
- `curl -sS -m 15 -D - https://evolution-api-production-405f.up.railway.app/api/healthz/deep`
- `git for-each-ref --format='%(refname:short) %(objectname) %(upstream:short)' refs/heads refs/remotes`
- `git fsck --no-progress --connectivity-only`

## Consistência Git ↔ arquivos ↔ deploy

### Git local

- Branch atual verificada: `work` em `b4c224587fb4ceaedf2ae2141fa31456a4a66b9d`.
- `git status --short --branch` antes desta documentação indicou árvore limpa em `## work`.
- Não há remote configurado retornado por `git remote -v`.
- `git for-each-ref` retornou somente `work b4c224587fb4ceaedf2ae2141fa31456a4a66b9d` e nenhum upstream.
- `git fsck --no-progress --connectivity-only` finalizou com exit code 0.

### Commits analisados

1. `b4c2245` — `fix(sprint-3a-to-3d): multi-tenant isolation, observability, telemetry`
2. `2cdbda9` — `Merge pull request #62 from Taranto1987/claude/multi-tenant-saas-system-jiHJt`
3. `6158bde` — `docs: add Phase 3 master engineering review — consolidated audit of Sprints 1–2`
4. `48eeff9` — `Merge pull request #58 from Taranto1987/claude/multi-tenant-saas-system-jiHJt`
5. `686c4dd` — `merge: integrate PR #57 infrastructure (graceful shutdown, DB indexes, score decay, loja whitelist) into PR #58 hardening`
6. `1c1cac6` — `Merge pull request #57 from Taranto1987/claude/castor-saas-platform-arch-ubeKk`
7. `6060bb4` — `fix: resolve all 12 pre-merge stabilization blockers (9 critical + 3 high)`
8. `51ea9f3` — `add DB indexes to remaining tables (chat_events, automation_log, usuarios, colaboradores, financeiro)`
9. `2c4e382` — `fix: customerName must be let after rebase (profile.name assignment)`
10. `58bcd6b` — `port infrastructure from PR #55: graceful shutdown, loja whitelist, SSE abort, DB indexes`

### Arquivos modificados no commit HEAD `b4c2245`

- Modificados: `CLAUDE.md`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/lib/followup-scheduler.ts`, `artifacts/api-server/src/lib/recorrentes-scheduler.ts`, `artifacts/api-server/src/routes/chat.ts`, `artifacts/api-server/src/routes/health.ts`, `artifacts/api-server/src/routes/orcamento.ts`, `artifacts/api-server/src/routes/produtos.ts`, `artifacts/api-server/src/routes/waha.ts`, `artifacts/api-server/src/services/memory/identity.ts`, `artifacts/api-server/src/services/orcamento/repository.ts`, `artifacts/api-server/src/services/scoring/updater.ts`, `lib/db/src/index.ts`, `lib/db/src/schema/financeiro.ts`, `lib/db/src/schema/lead-scores.ts`.
- Adicionado: `OPERATING_NOTES.md`.
- Deletados: `artifacts/api-server/src/core/classifier.ts`, `artifacts/api-server/src/core/guardrails.ts`, `artifacts/api-server/src/core/orchestrator.ts`, `artifacts/api-server/src/routes/webhook-whatsapp.ts`, `artifacts/api-server/src/services/agente.ts`, `artifacts/api-server/src/services/chat/context-builder.ts`, `artifacts/api-server/src/services/chat/response-validator.ts`, `artifacts/api-server/src/services/chat/truth-state.ts`, `artifacts/api-server/src/services/model-router.ts`.

### Verificação de arquivos atuais contra commits

- Os arquivos deletados em `b4c2245` não existem no filesystem atual.
- `rg` não encontrou imports remanescentes para os caminhos deletados listados acima.
- O build do servidor (`pnpm --filter @workspace/api-server run build`) finalizou com exit code 0 e gerou `artifacts/api-server/dist/index.cjs` sem deixar diff rastreado.
- O status Git permaneceu sem diff rastreado após typecheck, lint e build antes desta documentação.

### Deploy

- O manifesto Railway declara deploy automático apenas via branch `main`, enquanto a branch local disponível é `work`; sem remote e sem upstream local, a equivalência `work` ↔ produção é **NÃO VERIFICADA**.
- `railway.json` declara `releaseCommand: pnpm --filter @workspace/db run push`, `startCommand: pnpm --filter @workspace/api-server start` e healthcheck `/api/healthz`.
- `Dockerfile` executa `pnpm --filter @workspace/api-server run build` no estágio builder e inicia `node artifacts/api-server/dist/index.cjs` no estágio production.
- `artifacts/castor-orcamento/vercel.json` reescreve `/api/:path*` para `https://evolution-api-production-405f.up.railway.app/api/:path*`.
- Tentativas de `curl` para `/api/healthz` e `/api/healthz/deep` nesse host retornaram 403 do túnel HTTP no ambiente atual. Portanto, runtime de produção/deploy real é **NÃO VERIFICADO**.

### Arquivos divergentes

- Divergência local Git ↔ filesystem rastreado antes deste relatório: nenhuma verificada.
- Divergência branch local ↔ deploy: **NÃO VERIFICADO** por ausência de remote/upstream e por 403 no acesso HTTP ao host indicado.
- Commits parcialmente aplicados/cherry-picks incompletos: **NÃO VERIFICADO**; não há evidência local de working tree parcial, mas não há remote/upstream para comparar histórico completo.
- Arquivos gerados mas não integrados: `lib/api-client-react/src/generated`, `lib/api-zod/src/generated` e respectivos `dist/generated` existem; sua integração runtime foi **NÃO VERIFICADA** além do typecheck/build.
- Código presente no repo mas ausente no runtime: **NÃO VERIFICADO** para produção; no Docker runtime são copiados `lib`, `artifacts/api-server/dist`, `node_modules` e `artifacts/api-server/node_modules`.

## Verificação das FASES 1–5

| Item | Status operacional | Evidência concreta |
| --- | --- | --- |
| schema recovery | PARCIAL | Existem schemas Drizzle e `drizzle-kit push`, mas não existe diretório `lib/db/migrations` no filesystem auditado; validação contra DB real não foi executada por ausência de `DATABASE_URL`. |
| `env-validator.ts` | NÃO IMPLEMENTADO | `find` não encontrou arquivo com nome compatível; existe somente `artifacts/api-server/src/utils/env.ts`. |
| `scheduler-stabilization.ts` | NÃO IMPLEMENTADO | `find` não encontrou arquivo com nome compatível. |
| `observabilidade.ts` | NÃO IMPLEMENTADO | `find` não encontrou arquivo com nome compatível. |
| Boot sequence da FASE 5 | PARCIAL | `index.ts` valida env, porta, inicia HTTP, depois schedulers/seeds/hydration; não há boot gate transacional nem schema validation no startup. Além disso, `@workspace/db` é importado antes de `validateEnv`, causando falha por `DATABASE_URL` dentro de `lib/db/src/index.ts` antes do validator próprio. |
| tenant guards | PARCIAL | Há `requireAuth`, `sessionLojaId`, `resolveLojaId` e whitelist in-memory de lojas; há rotas e repositórios com fallback `lojaId = 1` ou filtros opcionais. |
| `assertTenantOwnership` | NÃO IMPLEMENTADO | `rg` não encontrou `assertTenantOwnership`. |
| `healthz/deep` | IMPLEMENTADO | Rota local existe e executa `SELECT 1` no pool, retornando stats do pool em sucesso e 503 em erro. Produção não verificada por 403. |
| scheduler locks persistentes | NÃO IMPLEMENTADO | Não há `pg_advisory`, tabela de locks ou BullMQ lock nos schedulers auditados; há apenas flags/handles in-memory. |
| AI usage tracking | PARCIAL | `routes/chat.ts` registra `ai_usage` e `session_complete` em logs, mas não foi verificada persistência em tabela de uso/custo. |
| correlation IDs | IMPLEMENTADO | Middleware gera `requestId`, `correlationId`, grava em `res.locals`, em headers e child logger. |
| migration validation no boot | NÃO IMPLEMENTADO | Boot importa DB e abre pool; não há rotina de comparar migrations/schema nem validação de colunas/tabelas antes de iniciar HTTP/schedulers. |

## Verificação runtime real

| Pergunta | Resultado |
| --- | --- |
| Runtime atual executa schedulers? | NÃO VERIFICADO em produção. No código, `index.ts` chama `iniciarSchedulerRecorrentes()` e `iniciarSchedulerFollowUps()` dentro do callback de `app.listen`. Runtime local não subiu sem `DATABASE_URL`. |
| Possui env vars válidas? | NÃO VERIFICADO. No ambiente local auditado, `DATABASE_URL`, `PORT`, `ANTHROPIC_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WAHA_URL`, `WAHA_SESSION_NAME`, `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN` e `ALLOWED_ORIGINS` estavam ausentes. |
| Conecta no Neon real? | NÃO VERIFICADO. Nenhum `DATABASE_URL` real estava disponível. |
| Conecta na Evolution API real? | NÃO VERIFICADO. Variáveis `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` estavam ausentes localmente; endpoint externo retornou 403 no ambiente atual. |
| Executa Anthropic real? | NÃO VERIFICADO. `ANTHROPIC_API_KEY` estava ausente localmente. |
| Possui boot gates ativos? | PARCIAL. Existe exigência de `DATABASE_URL` e `PORT`, mas a falha local ocorreu no import de `@workspace/db` antes da mensagem do `validateEnv`. |
| Possui schema validation no startup? | NÃO IMPLEMENTADO. Não há rotina de validação de migrations/schema no startup. |
| Possui tenant-safe repositories? | PARCIAL. Alguns repositórios exigem `lojaId`; outros aceitam `lojaId` opcional ou usam fallback `1`, e há operações de update/delete por `id` sem `lojaId` obrigatório. |

## Verificação estrutural profunda

### Bootstrap e `index.ts`

- O bootstrap importa `pool` de `@workspace/db` em top-level antes de chamar `validateEnv`.
- Como `lib/db/src/index.ts` lança erro se `DATABASE_URL` estiver ausente, o runtime local falhou antes de completar boot.
- Schedulers são iniciados dentro de `app.listen`, depois que o servidor já aceitou iniciar.
- Seeds/hydration/refresh de lojas são disparados com `.catch(() => null)` ou logs, sem bloquear boot.

### Schedulers

- `recorrentes-scheduler` filtra recorrentes por `ativo = true`, mas não isola por tenant durante o ciclo global; a deduplicação usa `recorrenteId` e `categoria`, depois verifica mês/ano em memória.
- `recorrentes-scheduler` não possui flag `_running`; ciclos podem sobrepor se uma execução demorar e a próxima janela horária disparar.
- `followup-scheduler` possui `_cicloRunning` in-memory para evitar overlap dentro do mesmo processo, mas não possui lock distribuído/persistente entre réplicas.
- `followup-scheduler` busca orçamentos pendentes e follow-ups pendentes sem `lojaId` na query global; processa todos os tenants no mesmo ciclo/processo.
- `cicloScoreDecay` busca e atualiza `leadScores` sem isolamento por tenant no ciclo global.

### Repositories e tenant propagation

- `catalog/repository.ts` é tenant-safe nas leituras verificadas porque recebe `lojaId` obrigatório e filtra por `produtosTable.lojaId`.
- `chat/repository.ts` possui `getProductContext(lojaId = 1)`, ou seja, fallback de tenant em leitura de catálogo.
- `finance/repository.ts` possui leituras por `lojaId`, mas `createDespesa`, `createDespesaRecorrente`, `updateDespesa`, `deleteDespesa`, `updateDespesaComprovante` e `disableDespesaRecorrente` aceitam ou executam operações sem `lojaId` obrigatório.
- `orcamento/repository.ts` possui `findProdutosByIds`, `findHistorico` e `findOrcamentoById` com `lojaId` opcional; `fecharVendaTransaction` atualiza orçamento e estoque por `id` sem `lojaId` obrigatório dentro da transação.
- `usuarios/repository.ts` possui `findUsuarioByEmail`, `findUsuarioById`, `updateUsuarioSenha`, `updateUsuarioCargo`, `toggleUsuarioAtivo`, `updateUltimoLogin`, convites e reset tokens sem filtro por `lojaId`; parte disso pode ser aceitável para identidade global, mas não foi verificado um `assertTenantOwnership` antes de operações administrativas.

### Async flows, caches, SSE cleanup, locks, retries e dedup

- SSE cleanup existe no módulo WAHA por sessão em memória e cleanup periódico; validação runtime de vazamento em produção é **NÃO VERIFICADA**.
- Cache/session map WAHA é escopado por chave `${lojaId}:${phone}`, mas permanece in-memory.
- `VALID_LOJA_IDS` é whitelist in-memory atualizada por polling; se refresh falha, mantém set anterior.
- Retries reais/persistentes para WAHA/Evolution não foram verificados; follow-up apenas loga erro e tenta no próximo ciclo.
- Dedup forte via unique/persistência foi verificado parcialmente nos schemas, mas múltiplos fluxos ainda fazem checagem select-then-insert sem lock transacional em scheduler.

## Consistência multi-tenant

| Controle | Status | Evidência |
| --- | --- | --- |
| `WHERE loja_id` obrigatório | PARCIAL | Presente em várias leituras; ausente/opcional em schedulers e mutações por ID. |
| Composite uniques tenant-safe | PARCIAL | Há índices únicos compostos em algumas tabelas, como mensagens WAHA; `produtos` ainda tem unique global de SKU/slug quando não nulo. |
| Propagation do TenantContext | PARCIAL | Existe tipo `TenantContext` e resolvedores por sessão/operação, mas não há AsyncLocalStorage/withTenant global e muitos métodos recebem `lojaId` manualmente. |
| Isolamento entre schedulers | NÃO IMPLEMENTADO | Schedulers globais sem lock persistente e sem particionamento por tenant. |
| Isolamento entre caches | PARCIAL | WAHA session key contém tenant; whitelist de lojas é global; outras caches/estado em memória não foram todas provadas isoladas. |
| Isolamento entre AI context | PARCIAL | Chat público resolve `lojaId` por header validado/fallback; não foi verificado isolamento persistente de todos os contextos de IA. |
| Isolamento entre filas/processamentos | NÃO VERIFICADO | Não foi verificado worker/fila ativa; BullMQ/Redis existem como dependências, mas runtime de filas não foi confirmado. |

## Implementações faltantes

- Arquivos específicos `env-validator.ts`, `scheduler-stabilization.ts` e `observabilidade.ts`.
- Função `assertTenantOwnership`.
- Locks persistentes/distribuídos de scheduler.
- Migration/schema validation no startup.
- Boot gate que valide DB/schema antes de `app.listen` e antes de iniciar schedulers.
- Tenant obrigatório em todos os repositories/mutations por ID.
- Verificação operacional de deploy real, Neon real, Evolution real e Anthropic real.

## Implementações parciais

- Env validation: existe `utils/env.ts`, mas não valida URLs, formatos, Evolution/WAHA de forma obrigatória e é precedido por import do DB.
- Observabilidade: request/correlation IDs, logger Pino, health deep e logs de AI/scheduler existem, mas não há módulo `observabilidade.ts` nem persistência auditada de AI usage.
- Tenant guards: sessão e whitelist existem, mas há fallbacks e parâmetros opcionais.
- Health deep: implementado no código, não verificado em deploy.
- AI usage: logging implementado, persistência não verificada.
- Schema recovery: schemas e push existem, migrations/validação runtime não.

## Riscos críticos ativos

| Risco | Classificação | Evidência |
| --- | --- | --- |
| Boot local falha sem `DATABASE_URL` antes de `validateEnv` emitir sua própria mensagem | crash risk: ALTO; operational risk: ALTO | `@workspace/db` é importado antes de `validateEnv`; start local falhou em `lib/db` com `DATABASE_URL must be set`. |
| Schedulers sem lock persistente/distribuído | corruption risk: ALTO; operational risk: ALTO | Schedulers usam `setInterval`, handles e flag in-memory; não há advisory lock/tabela de locks. |
| Schedulers globais sem particionamento tenant-safe nas queries | tenant leak risk: ALTO; corruption risk: ALTO | Queries de follow-ups/decay e recorrentes não recebem `lojaId` como escopo de ciclo. |
| Mutations por ID com `lojaId` opcional/ausente | tenant leak risk: ALTO; corruption risk: ALTO | Repositories de financeiro/orçamento/usuários aceitam operações por ID sem `lojaId` obrigatório. |
| Deploy produção não verificável a partir da branch local | operational risk: ALTO | Branch local `work`, Railway declara deploy por `main`, não há remote/upstream local, curl retornou 403. |
| Lint com warnings | observability risk: BAIXO; operational risk: MÉDIO | `pnpm run lint` exit 0, mas reportou 29 warnings. |
| Healthcheck Railway usa `/api/healthz`, não `/api/healthz/deep` | observability risk: MÉDIO | Healthcheck superficial não valida DB real; deep existe mas não é o healthcheck do deploy. |

## Resultado dos checks

- `pnpm run typecheck`: PASSOU com exit code 0. Houve warning Node `[DEP0169]` durante execução.
- `pnpm run lint`: PASSOU com exit code 0, mas reportou 29 warnings ESLint.
- `pnpm --filter @workspace/api-server run build`: PASSOU com exit code 0. Houve warning Node `[DEP0169]`.
- `pnpm --filter @workspace/api-server start`: FALHOU com exit code 1 no ambiente local por ausência de `DATABASE_URL`.
- `curl` para `https://evolution-api-production-405f.up.railway.app/api/healthz`: FALHOU/NÃO VERIFICADO por 403 do túnel HTTP no ambiente atual.
- `curl` para `https://evolution-api-production-405f.up.railway.app/api/healthz/deep`: FALHOU/NÃO VERIFICADO por 403 do túnel HTTP no ambiente atual.

## Conclusão operacional

O repositório local compila e passa typecheck, mas a implementação real das FASES 1–5 está incompleta para operação multi-tenant robusta. Os maiores bloqueadores concretos são ausência de lock persistente de schedulers, ausência de schema/migration validation no startup, boot que importa DB antes do validator próprio, tenant guards parciais com `lojaId` opcional/fallback em repositories, e impossibilidade de verificar deploy/Neon/Evolution/Anthropic reais com os artefatos e acesso disponíveis neste ambiente.
