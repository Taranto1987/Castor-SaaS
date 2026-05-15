FROM node:22-alpine AS base
WORKDIR /app

# Copy manifests first — pnpm install layer is cached until any package.json or lockfile changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/api-server/package.json           ./artifacts/api-server/
COPY artifacts/castor-orcamento/package.json     ./artifacts/castor-orcamento/
COPY artifacts/mockup-sandbox/package.json       ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json           ./lib/api-client-react/
COPY lib/api-spec/package.json                   ./lib/api-spec/
COPY lib/api-zod/package.json                    ./lib/api-zod/
COPY lib/db/package.json                         ./lib/db/
COPY lib/integrations-gemini-ai/package.json     ./lib/integrations-gemini-ai/
COPY lib/integrations-openai-ai-server/package.json ./lib/integrations-openai-ai-server/
COPY scripts/package.json                        ./scripts/

RUN corepack enable && pnpm install --frozen-lockfile

# ── Build stage ─────────────────────────────────────────────────────────────
FROM base AS builder
COPY . .
RUN pnpm --filter @workspace/api-server run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/.npmrc ./
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules

RUN corepack enable

USER appuser

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/healthz || exit 1

CMD ["node", "artifacts/api-server/dist/index.cjs"]
