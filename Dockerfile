FROM node:20-alpine

WORKDIR /app

# Copy workspace configuration and all package.json files for dependency resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/castor-orcamento/package.json ./artifacts/castor-orcamento/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY lib/integrations-gemini-ai/package.json ./lib/integrations-gemini-ai/
COPY lib/integrations-openai-ai-server/package.json ./lib/integrations-openai-ai-server/
COPY scripts/package.json ./scripts/

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @workspace/api-server run build

CMD ["node", "artifacts/api-server/dist/index.cjs"]
