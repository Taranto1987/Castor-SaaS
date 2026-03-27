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
- `/dashboard` — Métricas, funil de conversão, **meta do mês** com barra de progresso (persistida no banco via API, editável pelo dono), top produtos, por vendedor
- `/financeiro` — **Gestão Financeira Completa** (apenas dono): Visão Geral (KPIs lucro/receita/despesas, alertas inteligentes, resumo diário WhatsApp), Despesas (CRUD + recorrentes automáticas + confirmação), Comissões (2% padrão, configurável por vendedor, cálculo automático sobre vendas), DRE Simplificado (receita - custos - despesas - comissões = lucro líquido)
- `/logistica` — Controle de entregas + **Roteiro Otimizado do Pedro** + ao marcar entregue: **modal de avaliação Google** com link correto por loja (CF vs Araruama)
- `/equipe/clientes` — **CRM básico**: agrupa orçamentos por cliente (WA/nome), mostra total gasto, # compras, última visita, taxa de conversão, badge recorrente/prospect
- `/outlet` — **Outlet por Encomenda**: produtos da fábrica sem estoque, margem 60% automática, badge "Encomenda X dias", fluxo de pedido por WA; admins podem adicionar/remover produtos
- `/estoque` — **Controle de Estoque**: lista todos os produtos não-encomenda, badges (esgotado/baixo/OK), filtros, busca. Dono pode ajustar quantidade com +/-. **Baixa automática** ao fechar venda (`/orcamento/:id/fechar`). Catálogo público esconde produtos com estoque=0.
- `/ranking-outlet` — **Ranking Outlet** (apenas dono): ranking dos produtos mais pedidos por encomenda, com total de interesses e data do último pedido. Custo, preço outlet (60%) e sugestão pronta-entrega (100%). Botão "Promover para estoque" converte encomenda → catálogo regular com quantidade e preço ajustável.
- `/entrada-estoque` — **Entrada de Estoque via Foto**: tira foto da nota fiscal → Gemini Vision extrai itens (nome, qtd, SKU, preço custo) → matching automático com catálogo → revisão e confirmação → estoque atualizado. Histórico de entradas registrado. Apenas dono.
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

### Auth & Isolamento de Dados
- Códigos: THALLES (dono/CF), MARCELA (vendedor/CF), VAGNER (vendedor/CF), NETE (vendedor/Araruama), PEDROPAULO (vendedor/Araruama), CASTOR2 (admin/CF), ENTREGA (Pedro/entrega)
- sessionStorage, AuthContext, LoginScreen brandado
- **Isolamento por papel**: APIs recebem `?vendedor=NOME&papel=PAPEL`. Dono vê tudo, vendedor vê só seus próprios dados (histórico, dashboard, clientes, entregas). Pedro (entrega) vê todas as entregas.
- **Financeiro auth**: rotas financeiras usam sessão server-side via `x-session-token` header. Login em POST /api/auth/login retorna token validado pelo servidor. requireDono verifica sessão + papel=dono. GET /metas é público para Dashboard.
- **Recurring expenses**: scheduler automático roda ao iniciar o servidor e a cada hora. No horário 00:00, gera despesas recorrentes do mês automaticamente (com idempotência por recorrenteId+mês+ano). Despesas geradas ficam com confirmada=false aguardando aprovação do dono.

## Categorias coletadas

- colchoes
- cama-box
- cama-box-colchao
- travesseiros
- roupa-de-cama
- protetor

## API Endpoints

- `POST /api/auth/login` — cria sessão server-side (body: code) → retorna token, nome, papel
- `GET /api/auth/me` — valida sessão (header: x-session-token)
- `POST /api/auth/logout` — destrói sessão
- `GET /api/produtos` — lista produtos (params: categoria, limite, interno=1 para incluir esgotados)
- `GET /api/produtos/outlet` — lista produtos com encomenda=true
- `POST /api/produtos/outlet` — cria produto de encomenda (custo × 1.6 = precoPix automático)
- `PATCH /api/produtos/:id/encomenda` — toggle encomenda (boolean)
- `PATCH /api/produtos/:id/disponibilidade` — toggle disponivel
- `GET /api/produtos/buscar?q=texto` — busca por texto
- `GET /api/produtos/categorias` — lista categorias
- `POST /api/produtos/outlet/:id/interesse` — registra interesse (clique em "Pedir") num produto outlet
- `GET /api/produtos/outlet/ranking` — ranking de produtos outlet por total de interesses
- `POST /api/produtos/outlet/:id/promover` — converte produto de encomenda para estoque regular (body: {estoque, precoPix?})
- `GET /api/produtos/estoque` — lista produtos não-encomenda para controle de estoque
- `PATCH /api/produtos/:id/estoque` — atualiza estoque (body: {estoque: number})
- `GET /api/produtos/:id` — produto por ID
- `POST /api/orcamento` — gera orçamento
- `POST /api/orcamentos/salvar` — salva orçamento no histórico
- `GET /api/orcamentos/historico` — lista orçamentos salvos
- `POST /api/orcamentos/:id/fechar` — fecha venda (cria entrega automaticamente)
- `GET /api/entregas` — lista entregas
- `POST /api/entregas` — cria entrega
- `PATCH /api/entregas/:id/status` — atualiza status
- `GET /api/dashboard` — dados analíticos da operação
- `GET /api/financeiro/despesas` — lista despesas (params: mes, ano, categoria)
- `POST /api/financeiro/despesas` — cria despesa
- `PUT /api/financeiro/despesas/:id` — atualiza despesa
- `DELETE /api/financeiro/despesas/:id` — remove despesa
- `GET /api/financeiro/despesas-recorrentes` — lista templates recorrentes
- `POST /api/financeiro/despesas-recorrentes` — cria template recorrente
- `DELETE /api/financeiro/despesas-recorrentes/:id` — desativa recorrente
- `POST /api/financeiro/gerar-recorrentes` — gera despesas do mês a partir dos templates
- `GET /api/financeiro/comissoes` — lista config de comissões
- `POST /api/financeiro/comissoes` — salva/atualiza percentual de comissão por vendedor
- `GET /api/financeiro/comissoes/calculo` — calcula comissões do mês (params: mes, ano)
- `GET /api/financeiro/dre` — DRE simplificado do mês (receita, custos, despesas, comissões, lucro)
- `GET /api/financeiro/resumo-diario` — resumo do dia formatado para WhatsApp
- `GET /api/financeiro/metas` — busca meta do mês (params: mes, ano, operacao)
- `POST /api/financeiro/metas` — salva/atualiza meta do mês
- `GET /api/financeiro/alertas` — alertas inteligentes (meta em risco, followup, despesas acima da média, margem baixa)
- `GET /api/financeiro/categorias-despesa` — lista categorias pré-definidas
- `GET /api/financeiro/evolucao` — evolução mensal de faturamento, despesas e lucro (params: meses)
- `POST /api/financeiro/despesas/:id/comprovante` — upload de comprovante (imagem) para uma despesa
- `POST /api/entrada-estoque/extrair` — upload imagem nota fiscal → Gemini Vision extrai itens (auth: dono)
- `POST /api/entrada-estoque/match` — matching automático dos itens extraídos com catálogo (auth: dono)
- `POST /api/entrada-estoque/confirmar` — confirma entrada, atualiza estoque e preço de custo (auth: dono)
- `GET /api/entrada-estoque/historico` — histórico de entradas (auth: dono)
- `GET /api/entrada-estoque/produtos/buscar?q=` — busca produtos para vinculação manual (auth: dono)
- `POST /api/crawler/iniciar` — inicia coleta do site Castor
- `GET /api/crawler/status` — status da coleta

## Schema DB
- `produtos`: id, nome, sku, preco, precoPix, parcelamento, medidas, altura, categoria, imagem, link, disponivel, **encomenda** (bool), **custoBRL**, **prazoEncomenda**, **estoque** (integer, null=sem controle, 0=esgotado), criadoEm
- `orcamentos`: id, cliente, whatsapp, produtosJson, observacoes, descontoPix, totalPix, totalPrazo, texto, vendedor, **status** (pendente|vendido), criadoEm
- `entregas`: id, orcamentoId, cliente, whatsapp, endereco, produtos, status, vendedor, observacoes, dataEntrega, criadoEm
- `outlet_interesses`: id, produto_id, criado_em — rastreia cada clique "Pedir" no Outlet para ranking de demanda
- `crawler_status`: id, status, mensagem, totalProdutos, produtosColetados, erros, iniciadoEm, finalizadoEm, atualizadoEm
- `despesas`: id, valor (numeric), categoria, descricao, comprovante, recorrente, recorrenteId, confirmada, data, criadoEm
- `despesas_recorrentes`: id, valor, categoria, descricao, ativo, diaVencimento, criadoEm
- `comissoes_config`: id, vendedor (unique), percentual (default 2%), criadoEm
- `entradas_estoque`: id, fornecedor, imagemNota, totalItens, criadoEm
- `itens_entrada_estoque`: id, entradaId (FK), produtoId (FK nullable), nomeExtraido, skuExtraido, quantidade, precoCusto, criadoEm
- `metas`: id, mes, ano, valor (numeric), operacao, criadoEm

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
│   ├── integrations-gemini-ai/  # Gemini AI SDK client (Replit AI Integrations)
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
