FROM oven/bun:latest AS deps
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --production --frozen-lockfile

FROM oven/bun:latest AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3001

# Pass the current git commit at build time:
#   docker build --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) -t app:latest .
ARG GIT_COMMIT_SHA
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

CMD ["bun", "start:server"]
