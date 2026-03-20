FROM oven/bun:1.3.11 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps apps
COPY packages packages
COPY tsconfig.base.json ./
COPY tsconfig.json ./

RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.11
WORKDIR /app

# Install curl, git, and CA certificates (Ubuntu/Debian)
USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates git; \
    rm -rf /var/lib/apt/lists/*
USER bun

COPY --from=deps /app/package.json ./
COPY --from=deps /app/bun.lock ./
COPY --from=deps /app/node_modules node_modules

COPY apps/server apps/server
COPY packages packages
COPY tsconfig.base.json ./
COPY tsconfig.json ./

EXPOSE 3001
CMD ["bun", "run", "--cwd", "apps/server", "start"]
