# Deploy Readiness — Castor SaaS

> Fonte única de configuração de deploy. Baseado em evidência do repo
> (`railway.json`, `vercel.json`, `utils/env.ts`, CLAUDE.md) e dos painéis.
> Governança: **um agente de execução por vez**; segredos e painel = decisão humana;
> **nada vai pra `main` sem OK explícito** (CFO RULE — projeto Railway único).

## 1. Como o sistema sobe

| Camada | Onde | Comando / regra |
|---|---|---|
| Backend | Railway (projeto **`diligent-endurance`**) | build Dockerfile · `releaseCommand: pnpm --filter @workspace/db run push` · `start: api-server` · healthcheck `/api/healthz` |
| Banco | Railway Postgres | schema aplicado por `db push` no release (sem pasta de migrations) |
| Frontend | Vercel (projeto `castor-saa-s-castor-orcamento`) | Vite build · `vercel.json` faz rewrite `/api/* → backend Railway` |
| Deploy automático | **apenas branch `main`** | feature branches NÃO deployam no Railway |

## 2. Variáveis de ambiente (fonte: `utils/env.ts`)

**Obrigatórias (boot falha sem):** `DATABASE_URL`, `PORT` → ✅ já no Railway.

**Opcionais (degradam):** `ANTHROPIC_API_KEY`, `CASTOR_AGENT_ID`, `CASTOR_ENVIRONMENT_ID`,
`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_GEMINI_API_KEY`,
`EVOLUTION_API_URL/KEY/WEBHOOK_TOKEN`, `WAHA_URL/WEBHOOK_SECRET`,
`WHATSAPP_PROVIDER/API_URL/API_TOKEN/INSTANCE_ID`, `ALLOWED_ORIGINS`.

**Faltando no Railway hoje (ligam chat/OCR):** `OPENAI_API_KEY`,
`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_GEMINI_API_KEY` → 🔴 você adiciona no painel.

**Não usadas (removidas do `.env.example`):** `REDIS_URL`/BullMQ, `ZAPI_TOKEN`.

## 3. Vercel — por que previews aparecem "Ignored/Cancelado"

**Não é o plano free nem fila.** O projeto tem um **Ignored Build Step**:

```
[[ "$VERCEL_GIT_COMMIT_REF" == claude/* ]] && exit 0 || exit 1
```

→ qualquer branch `claude/*` é **pulada de propósito** (provável guard de custo).
Confirmado nos logs de build (`exit 0` → "canceled by Ignored Build Step").

**Implicações:**
- Branches `claude/*` nunca geram preview.
- Branch fora desse padrão (ex.: `preview/coca`) **builda** normalmente.
- `main` builda e vai a produção.
- O preview faz proxy de `/api` → backend Railway de **produção** (mostra dados reais;
  telas novas que dependem de tabela ainda não criada dão erro/vazio).

## 4. Plano Vercel
Hobby ("Passatempo") — "compilações simultâneas sob demanda" é recurso **Pro**.
Não é necessário: basta não empurrar vários commits em rajada (cada novo cancela o anterior).

## 5. Checklist para "ir ao ar" (ordem estratégica + governança)

| # | Ação | Dono | Toca produção? |
|---|---|---|---|
| 1 | Preview da COCA (branch `preview/coca`) | 🟢 agente | ❌ |
| 2 | Limpar `.env.example` | 🟢 agente | ❌ |
| 3 | Este doc (`DEPLOY_READINESS.md`) | 🟢 agente | ❌ |
| 4 | Adicionar 3 env vars de IA no Railway | 🔴 você | ❌ |
| 5 | Continuar COCA (Fase 5+) | 🟢 agente | ❌ |
| 6 | **Merge PR #72 → `main`** (cria `sales_opportunities` via `db push`) | 🔴 você decide | ✅ **ALTO** |
| 7 | WhatsApp real (Evolution/WAHA) | 🔴 você + 🟢 agente | médio |

**Regra fixa:** quando for o momento correto e seguro de tocar produção, o agente
comunica **EM CAIXA ALTA** que é necessário/ideal — e só segue com o OK humano.
