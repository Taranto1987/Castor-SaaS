# ── Build stage ──────────────────────────────────────────────────────────────
# Needs devDependencies (tsx, esbuild) to run the build script.
# pnpm-workspace.yaml must be present before `pnpm install` so that all
# workspace packages (lib/db, lib/api-zod, etc.) are resolved correctly.
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
# Workspace packages are bundled into dist/index.cjs by esbuild, so they are
# not needed at runtime. Only node_modules is copied for the small set of
# packages marked external by the build script (e.g. cheerio, cookie-parser).
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

CMD ["node", "artifacts/api-server/dist/index.cjs"]
