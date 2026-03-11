FROM oven/bun:latest
WORKDIR /app

COPY bun.lock package.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/auth-session/package.json packages/auth-session/package.json
COPY packages/backend/package.json packages/backend/package.json

RUN bun install --production --frozen-lockfile --ignore-scripts --filter @ai-chat/server

# Install curl, git, and CA certificates (Ubuntu/Debian)
USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates git; \
    rm -rf /var/lib/apt/lists/*
USER bun

COPY apps/server/src apps/server/src
COPY packages/shared/src packages/shared/src
COPY packages/auth-session/src packages/auth-session/src
COPY packages/backend/convex/_generated packages/backend/convex/_generated

EXPOSE 3001
CMD ["bun", "run", "--cwd", "apps/server", "start"]
