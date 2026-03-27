# Workspace

## Overview

Sistema de Catálogo e Gerador de Orçamentos para Castor Cabo Frio.

pnpm workspace monorepo usando TypeScript. Cada pacote gerencia suas próprias dependências.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Crawler**: Playwright (Chromium headless)

## Funcionalidades

### Público (sem login)
- `/` — Landing page: hero "Não vendemos colchão. Resolvemos o seu sono.", 7 cidades, tecnologias Castor, depoimentos Google, categorias. **WhatsApp inteligente**: detecta cidade do visitante via IP geolocation (ipapi.co) e direciona para o número correto (Araruama → Nete, outros → Thalles)
- `/catalogo` — Catálogo público com WhatsApp CTA
- `/mapa-sono` — Quiz de diagnóstico do sono (13 perguntas, recomendação personalizada com badges de tecnologia + custo por noite + link WhatsApp)

### Privado (código de acesso: THALLES / CASTOR2 / ENTREGA)
- `/equipe` — Catálogo interno com gerador de orçamento
- `/orcamento` — Gerador de orçamento formatado para WhatsApp
- `/historico` — Histórico de orçamentos com **follow-up automático**: badge "X dias em aberto" + botão "Cobrar" que gera mensagem WA pré-escrita + alerta de urgência para orçamentos ≥ 2 dias sem resposta
- `/dashboard` — Métricas, funil de conversão, **meta do mês** com barra de progresso (localStorage por operação, editável pelo dono), top produtos, por vendedor
- `/logistica` — Controle de entregas + **Roteiro Otimizado do Pedro** + ao marcar entregue: **modal de avaliação Google** com link correto por loja (CF vs Araruama)
- `/equipe/clientes` — **CRM básico**: agrupa orçamentos por cliente (WA/nome), mostra total gasto, # compras, última visita, taxa de conversão, badge recorrente/prospect
- `/outlet` — **Outlet por Encomenda**: produtos da fábrica sem estoque, margem 60% automática, badge "Encomenda X dias", fluxo de pedido por WA; admins podem adicionar/remover produtos
- `/crawler` — Atualização do banco de dados via crawler

### MapaSono — Mapa do Sono (público)
- Quiz 13 perguntas → motor de decisão MOLA vs ESPUMA
- **Após resultado**: busca produtos reais do catálogo que combinam com o perfil (MOLA/ESPUMA + firmeza), mostra até 3 com preço PIX + botão "Quero esse" direto no WA
- Calculadora de custo por noite (R$/3.650 noites)

### Roteiro do Pedro
- Cidades cobertas em ordem: Cabo Frio → Arraial do Cabo → São Pedro da Aldeia → Iguaba Grande → Araruama → Búzios → Saquarema
- Ponto de partida: Av. Júlia Kubitschek, 64, Cabo Frio
- Detecta cidade pelo endereço (keywords por cidade)
- Gera URL Google Maps com todas as paradas
- Botão WhatsApp por parada com mensagem pré-formatada para o Pedro

### Auth
- Códigos: THALLES (dono), CASTOR2 (irmã/admin), ENTREGA (Pedro/entregador)
- sessionStorage, AuthContext, LoginScreen brandado

## Categorias coletadas

- colchoes
- cama-box
- cama-box-colchao
- travesseiros
- roupa-de-cama
- protetor

## API Endpoints

- `GET /api/produtos` — lista produtos (params: categoria, limite)
- `GET /api/produtos/outlet` — lista produtos com encomenda=true
- `POST /api/produtos/outlet` — cria produto de encomenda (custo × 1.6 = precoPix automático)
- `PATCH /api/produtos/:id/encomenda` — toggle encomenda (boolean)
- `PATCH /api/produtos/:id/disponibilidade` — toggle disponivel
- `GET /api/produtos/buscar?q=texto` — busca por texto
- `GET /api/produtos/categorias` — lista categorias
- `GET /api/produtos/:id` — produto por ID
- `POST /api/orcamento` — gera orçamento
- `POST /api/orcamentos/salvar` — salva orçamento no histórico
- `GET /api/orcamentos/historico` — lista orçamentos salvos
- `POST /api/orcamentos/:id/fechar` — fecha venda (cria entrega automaticamente)
- `GET /api/entregas` — lista entregas
- `POST /api/entregas` — cria entrega
- `PATCH /api/entregas/:id/status` — atualiza status
- `GET /api/dashboard` — dados analíticos da operação
- `POST /api/crawler/iniciar` — inicia coleta do site Castor
- `GET /api/crawler/status` — status da coleta

## Schema DB
- `produtos`: id, nome, sku, preco, precoPix, parcelamento, medidas, altura, categoria, imagem, link, disponivel, **encomenda** (bool), **custoBRL**, **prazoEncomenda**, criadoEm
- `orcamentos`: id, cliente, whatsapp, produtosJson, observacoes, descontoPix, totalPix, totalPrazo, texto, vendedor, **status** (pendente|vendido), criadoEm
- `entregas`: id, orcamentoId, cliente, whatsapp, endereco, produtos, status, vendedor, observacoes, dataEntrega, criadoEm
- `crawler_status`: id, status, mensagem, totalProdutos, produtosColetados, erros, iniciadoEm, finalizadoEm, atualizadoEm

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (rotas: produtos, orcamento, crawler)
│   └── castor-orcamento/   # Frontend React + Vite
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/produtos.ts  # Tabelas: produtos, crawler_status
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
- Depends on: `@workspace/db`, `@workspace/api-zod`, `playwright`
- `pnpm --filter @workspace/api-server run dev` — run the dev server

### `artifacts/castor-orcamento` (`@workspace/castor-orcamento`)

Frontend React + Vite. Páginas: Home (catálogo + busca), Orçamento (gerador), Atualizar BD (crawler admin).

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/produtos.ts` — tabelas `produtos` e `crawler_status`
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec em `openapi.yaml`. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

## Notas de Uso

1. Ao abrir o sistema pela primeira vez, o banco está vazio
2. Vá na aba "Atualizar BD" e clique "Iniciar Coleta"
3. O sistema entra no site da Castor e coleta todos os produtos automaticamente (pode levar alguns minutos)
4. Após a coleta, os produtos aparecem no Catálogo
5. Use a busca para encontrar produtos e gere orçamentos formatados para WhatsApp
