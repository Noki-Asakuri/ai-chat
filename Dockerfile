# syntax=docker/dockerfile:1.7

FROM oven/bun:canary-slim AS base
WORKDIR /app

FROM base AS pruner

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bunx turbo@2.10.8 prune @ai-chat/server --docker

FROM base AS dependencies

COPY --from=pruner /app/out/json/ ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --ignore-scripts --filter '@ai-chat/server'

FROM base AS runtime

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=pruner --chown=bun:bun /app/out/full/ ./
COPY --chown=bun:bun tsconfig.base.json ./

USER bun

EXPOSE 3001
CMD ["bun", "run", "--cwd", "apps/server", "start"]
