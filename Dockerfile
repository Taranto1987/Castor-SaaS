FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .

RUN pnpm --filter @workspace/api-server run build

CMD ["node", "artifacts/api-server/dist/index.cjs"]
