# syntax=docker/dockerfile:1.7

ARG NODE_DEV_IMAGE=node:22-bookworm-slim
ARG NODE_RUNTIME_IMAGE=node:22-bookworm-slim

FROM ${NODE_DEV_IMAGE} AS server-deps
WORKDIR /app
COPY apps/server/package.json apps/server/package-lock.json ./apps/server/
RUN npm ci --prefix apps/server

FROM ${NODE_DEV_IMAGE} AS admin-deps
WORKDIR /app
COPY apps/admin/package.json apps/admin/package-lock.json ./apps/admin/
RUN npm ci --prefix apps/admin

FROM ${NODE_DEV_IMAGE} AS server-build
WORKDIR /app
COPY --from=server-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY apps/server ./apps/server
RUN npm run build --prefix apps/server

FROM ${NODE_DEV_IMAGE} AS admin-build
WORKDIR /app
COPY --from=admin-deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN npm run build --prefix apps/admin

FROM ${NODE_DEV_IMAGE} AS server-prod-deps
WORKDIR /app
COPY apps/server/package.json apps/server/package-lock.json ./apps/server/
RUN npm ci --omit=dev --prefix apps/server

FROM ${NODE_RUNTIME_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server-prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY apps/server/package.json ./apps/server/package.json
COPY apps/server/migrations ./apps/server/migrations
COPY apps/server/seeds ./apps/server/seeds
COPY --from=server-build /app/apps/server/dist ./apps/server/dist
COPY --from=admin-build /app/apps/admin/dist ./apps/admin/dist
COPY storage/uploads/.gitkeep ./storage/uploads/.gitkeep
COPY storage/rendered/.gitkeep ./storage/rendered/.gitkeep
COPY storage/runtime/.gitkeep ./storage/runtime/.gitkeep
COPY storage/backups/.gitkeep ./storage/backups/.gitkeep
EXPOSE 3000
CMD ["node", "apps/server/dist/server.js"]
