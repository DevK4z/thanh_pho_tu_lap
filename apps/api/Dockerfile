# Build từ thư mục gốc repo: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @tptl/api --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @tptl/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @tptl/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
WORKDIR /app/apps/api
USER node
EXPOSE 8787
CMD ["node", "dist/index.js"]
