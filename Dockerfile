FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/
COPY tsconfig.json ./

# Install all deps (including devDeps — drizzle-kit is needed for releaseCommand)
RUN pnpm install --frozen-lockfile

# Build the API server
RUN pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production

CMD ["node", "artifacts/api-server/dist/index.cjs"]
