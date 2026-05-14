import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import { honoLoggerMiddleware } from "./middlewares/hono-logger";

import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

import { chatRouter } from "./routes/api.ai.chat";

import { env } from "./env";
import { printStartupBanner, registerShutdownHandler, trackInFlightRequests } from "./libs/server-lifecycle";

const PORT = 3001;

export const app = new Hono();

app.use(honoLoggerMiddleware);
app.use(secureHeaders());
app.use(requestId());
app.use("*", trackInFlightRequests);

app.use(
  "/api/*",
  cors({
    origin: env.WEB_APP_ORIGIN,
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "Cookie"],
    exposeHeaders: ["Content-Type", "X-Request-Id", "X-Stream-Id"],
    credentials: true,
    maxAge: 604_800,
  }),
);

app.get("/health", (ctx) => ctx.text("OK"));
app.get("/", function (ctx) {
  return ctx.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

app.all("/api/trpc/*", trpcServer({ endpoint: "/api/trpc", router: appRouter, createContext }));

app.route("/", chatRouter);

const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0,
  development: env.NODE_ENV === "development",
});

printStartupBanner(PORT);
registerShutdownHandler(server);
