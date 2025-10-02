FROM oven/bun:latest AS deps
WORKDIR /app
COPY bun.lock package.json ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --production --frozen-lockfile

FROM oven/bun:latest AS runner
WORKDIR /app

# Install curl, git, and CA certificates (Ubuntu/Debian)
USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates git; \
    rm -rf /var/lib/apt/lists/*
USER bun

RUN git config --global --add safe.directory /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3001

CMD ["bun", "start:server"]
