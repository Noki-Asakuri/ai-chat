FROM oven/bun:alpine AS deps
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --production --frozen-lockfile

FROM oven/bun:alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3001

CMD ["bun", "start:server"]
