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
- [ ] **Fase 2 — Widgets cruzados** (margens críticas; promover `/operacoes` a home)
- [ ] **Fase 3 — Histórico → Pipeline de Oportunidades**
- [ ] **Fase 4 — Follow-up Engine** (D2/D5/D10/reativação sobre `follow_ups`)
- [ ] **Fase 5 — Painel CRM lateral** (perfil biomecânico/compatibilidade via `diagnosticos` + `motor.ts`)
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
