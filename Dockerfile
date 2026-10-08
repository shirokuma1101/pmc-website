# syntax=docker/dockerfile:1.7
FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY tools/next-eslint-glob ./tools/next-eslint-glob
RUN npm ci

FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder
WORKDIR /app
ARG NEXT_PUBLIC_DIRECTUS_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_MINECRAFT_MAP_URL
ARG NEXT_PUBLIC_MINECRAFT_MAP_CONFIG_URL
ARG NEXT_PUBLIC_MINECRAFT_DEFAULT_WORLD
ARG NEXT_PUBLIC_MINECRAFT_DEFAULT_MAP
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_DIRECTUS_URL=${NEXT_PUBLIC_DIRECTUS_URL} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=${NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NEXT_PUBLIC_MINECRAFT_MAP_URL=${NEXT_PUBLIC_MINECRAFT_MAP_URL} \
    NEXT_PUBLIC_MINECRAFT_MAP_CONFIG_URL=${NEXT_PUBLIC_MINECRAFT_MAP_CONFIG_URL} \
    NEXT_PUBLIC_MINECRAFT_DEFAULT_WORLD=${NEXT_PUBLIC_MINECRAFT_DEFAULT_WORLD} \
    NEXT_PUBLIC_MINECRAFT_DEFAULT_MAP=${NEXT_PUBLIC_MINECRAFT_DEFAULT_MAP} \
    DIRECTUS_URL=${NEXT_PUBLIC_DIRECTUS_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runner
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
