ARG CHAINGUARD_NODE_DEV_IMAGE=cgr.dev/chainguard/node:latest-dev
ARG CHAINGUARD_NODE_RUNTIME_IMAGE=cgr.dev/chainguard/node:latest

FROM ${CHAINGUARD_NODE_DEV_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM ${CHAINGUARD_NODE_DEV_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM ${CHAINGUARD_NODE_DEV_IMAGE} AS runtime-tools
WORKDIR /opt/prisma-cli
COPY docker/prisma-cli/package.json docker/prisma-cli/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM ${CHAINGUARD_NODE_DEV_IMAGE} AS runtime-dirs
WORKDIR /runtime
RUN mkdir -p public/uploads storage storage/backups storage/cache storage/config

FROM ${CHAINGUARD_NODE_RUNTIME_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV PRISMA_BIN=/opt/prisma-cli/node_modules/prisma/build/index.js
ENV WORKER_BUNDLE=.next/worker/worker.cjs
ENV PATH=/opt/prisma-cli/node_modules/.bin:$PATH

COPY --from=runtime-tools --chown=1001:1001 /opt/prisma-cli /opt/prisma-cli
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --from=builder --chown=1001:1001 /app/.next/worker ./.next/worker
COPY --from=builder --chown=1001:1001 /app/prisma ./prisma
COPY --from=builder --chown=1001:1001 /app/public ./public
COPY --from=builder --chown=1001:1001 /app/src ./src
COPY --from=builder --chown=1001:1001 /app/scripts ./scripts
COPY --from=builder --chown=1001:1001 /app/tsconfig.json ./tsconfig.json
COPY --from=runtime-dirs --chown=1001:1001 /runtime/storage ./storage
COPY --from=runtime-dirs --chown=1001:1001 /runtime/public/uploads ./public/uploads

USER 0:0
EXPOSE 3000

ENTRYPOINT ["/usr/bin/node"]
CMD ["scripts/docker-entrypoint.mjs"]
