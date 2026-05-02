FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts ./

RUN npm install @prisma/adapter-pg @prisma/client

ENV NODE_ENV=production

EXPOSE 4001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
