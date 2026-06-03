# COCA — Central de Operações Comerciais Autônoma

> Plano de implementação vivo. Princípio central (CLAUDE.md): **dados antes de algoritmos**;
> **integração, não duplicação**. A COCA **consome** os módulos existentes — não cria um CRM paralelo.

## Decisão de modelagem

A COCA é uma **camada de orquestração** sobre o que já existe. Apenas **1 tabela nova**.

| Conceito | Casa (reuso) | Status |
|---|---|---|
| Eventos CRM | `eventos_operacionais` + `logEvent()` | ✅ reuso |
| Follow-up jobs | `follow_ups` + `followup-scheduler.ts` | ✅ reuso (a estender) |
| Sleep profile / compatibilidade | `diagnosticos` + `lib/motor.ts` | ✅ reuso |
| Lead score | `lead_scores` + `services/scoring/` | ✅ reuso (sem fórmula nova) |
| **Opportunity** | **`sales_opportunities` (NOVA)** | ✅ criada |

Chave: `serial` integer + FKs integer (consistente com todo o schema; **não** uuid).

## Status das fases

- [x] **Fase 0 — Fundação de dados**
  - `lib/db/src/schema/sales-opportunities.ts` (tabela nova, multi-tenant, unique `(loja_id, orcamento_id)`)
  - `services/operacoes/repository.ts` (`ensureOpportunityForOrcamento`, `markOpportunityWon`, `listOperacoes`, `parseBRL`)
- [x] **Fase 1 — Wiring + tela**
  - `routes/orcamento.ts`: `/salvar` cria/atualiza oportunidade + evento `ORCAMENTO_CRIADO`; `/:id/fechar` → `GANHO` + `VENDA_FECHADA`
  - `GET /api/operacoes` (pipeline + "Ação Agora" + widgets), filtrado por `lojaId`
  - Frontend `/operacoes` (Central de Operações) + item no menu
- [x] **Fase 2 — Widgets cruzados + home**
  - Widget "Margens Críticas" (produtos disponíveis com margem `(precoBase−factoryCost)/precoBase < 20%`)
  - `/operacoes` promovida a tela principal: redirect de usuário autenticado em `/`, item no topo do menu ("Comercial") e fixado na barra mobile
- [x] **Fase 3 — Histórico → Pipeline de Oportunidades**
  - `GET /api/operacoes/pipeline` (todas as oportunidades agrupáveis por status + contagem de follow-ups, escopo lojaId)
  - Histórico vira abas **Pipeline** (oportunidades por status, com score/probabilidade/próxima ação/follow-ups) **| Orçamentos** (lista existente preservada, fechar venda intacto)
- [x] **Fase 4 — Follow-up Engine**
  - Cadência COCA no scheduler existente: `FOLLOWUP_D2/D5/D10` + `REATIVACAO_D30` + `RECUPERACAO_D60` (janelas por dias sem resposta)
  - Cada estágio **avança o estado da oportunidade** (`AGUARDANDO_RESPOSTA → INTERVENCAO_HUMANA → REATIVACAO`) e a próxima ação
  - Eventos em `eventos_operacionais`: `FOLLOWUP_GERADO`, `REATIVACAO_INICIADA`, `FOLLOWUP_ENVIADO`
  - Contrato OpenAPI atualizado + client regenerado (Orval)
- [x] **Fase 5 — Painel CRM "Diagnóstico do Sono"**
  - `GET /leads/:id` agora inclui o último `diagnostico` do cliente (reuso de `diagnosticos`)
  - CRM (`ClienteDetalhe`) ganha card: produto recomendado + confiança, chance de fechamento (de `lead_scores`), suporte/firmeza/tecnologia, principal dor, perfil térmico, posição
  - Compatibilidade %/produto alternativo (SleepMap 4.0) NÃO incluídos — exigem motor de ranking inexistente (evitar fabricar sem dados)
- [ ] **Fase 6 — Automações Evolution API + pós-venda** (somente com credencial/infra)

## ⚠️ Passo de operação obrigatório (CLAUDE.md)

A tabela `sales_opportunities` é **declarada no schema** mas só é **aplicada no Postgres**
pelo `pnpm --filter @workspace/db run push` (pre-deploy da Railway, branch `main`).
Antes do merge, **validar o banco real** — nunca aplicar constraint sobre dados sujos.
Até a tabela existir no banco, `GET /api/operacoes` retorna erro 500 controlado (a tela mostra aviso).

## Fora de escopo agora (decisão de produto/infra)
- Envio de e-mail em `esqueci-senha` (precisa SMTP).
- Crawler multi-tenant (hoje single-store por design).
- Automação real de WhatsApp (Evolution API) — só na Fase 6.
