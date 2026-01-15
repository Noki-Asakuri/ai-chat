FROM oven/bun:latest
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --production --frozen-lockfile --ignore-scripts

# Install curl, git, and CA certificates (Ubuntu/Debian)
USER root
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates git; \
    rm -rf /var/lib/apt/lists/*
USER bun

RUN git config --global --add safe.directory /app

COPY . .

EXPOSE 3001
CMD ["bun", "start:server"]
