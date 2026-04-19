FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install -g pnpm && pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

CMD ["node", "artifacts/api-server/dist/index.cjs"]
