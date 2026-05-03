FROM node:20-alpine

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

# Copy source and build
COPY . .
RUN pnpm --filter @workspace/api-server run build

CMD ["node", "artifacts/api-server/dist/index.cjs"]
