FROM oven/bun:1.3.11
WORKDIR /app

COPY package.json bun.lock ./
COPY apps apps
COPY packages packages
COPY tsconfig.base.json ./
COPY tsconfig.json ./

RUN bun install --frozen-lockfile --production --ignore-scripts

# Install curl, git, and CA certificates (Ubuntu/Debian)
USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates git; \
    rm -rf /var/lib/apt/lists/*
USER bun

EXPOSE 3001
CMD ["bun", "run", "--cwd", "apps/server", "start"]
