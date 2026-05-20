FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV PRISMA_BIN=/opt/prisma-cli/node_modules/.bin/prisma
ENV WORKER_TSX_BIN=/opt/prisma-cli/node_modules/.bin/tsx

RUN apk add --no-cache su-exec \
  && npm install --prefix /opt/prisma-cli --omit=dev --no-audit --no-fund prisma@6.19.3 tsx@4.19.2 \
  && npm cache clean --force \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN chmod +x scripts/docker-entrypoint.sh && mkdir -p public/uploads storage storage/backups storage/cache storage/config && chown -R 1001:1001 /app

EXPOSE 3000

CMD ["sh", "scripts/docker-entrypoint.sh"]
