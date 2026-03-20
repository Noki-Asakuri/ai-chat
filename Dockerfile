FROM oven/bun:latest
WORKDIR /app

COPY package.json bun.lock tsconfig.json tsconfig.base.json ./
COPY apps/server apps/server
COPY packages packages

RUN bun install --frozen-lockfile --production

# Install curl, git, and CA certificates (Ubuntu/Debian)
USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates git; \
    rm -rf /var/lib/apt/lists/*
USER bun

EXPOSE 3001
CMD ["bun", "run", "start", "--cwd", "apps/server"]
