# syntax=docker/dockerfile:1.7
FROM node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS builder
WORKDIR /app
ARG NEXT_PUBLIC_DIRECTUS_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
ARG NEXT_PUBLIC_MINECRAFT_MAP_URL
ARG NEXT_PUBLIC_MINECRAFT_MAP_CONFIG_URL
ARG NEXT_PUBLIC_MINECRAFT_DEFAULT_WORLD
ARG NEXT_PUBLIC_MINECRAFT_DEFAULT_MAP
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_DIRECTUS_URL=${NEXT_PUBLIC_DIRECTUS_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} \
    NEXT_PUBLIC_MINECRAFT_MAP_URL=${NEXT_PUBLIC_MINECRAFT_MAP_URL} \
    NEXT_PUBLIC_MINECRAFT_MAP_CONFIG_URL=${NEXT_PUBLIC_MINECRAFT_MAP_CONFIG_URL} \
    NEXT_PUBLIC_MINECRAFT_DEFAULT_WORLD=${NEXT_PUBLIC_MINECRAFT_DEFAULT_WORLD} \
    NEXT_PUBLIC_MINECRAFT_DEFAULT_MAP=${NEXT_PUBLIC_MINECRAFT_DEFAULT_MAP} \
    DIRECTUS_URL=${NEXT_PUBLIC_DIRECTUS_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN apk upgrade --no-cache libcrypto3 libssl3 \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && rm -rf \
        /opt/yarn-v1.22.22 \
        /usr/local/lib/node_modules/corepack \
        /usr/local/lib/node_modules/npm \
    && rm -f \
        /usr/local/bin/corepack \
        /usr/local/bin/npm \
        /usr/local/bin/npx \
        /usr/local/bin/pnpm \
        /usr/local/bin/pnpx \
        /usr/local/bin/yarn \
        /usr/local/bin/yarnpkg
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
