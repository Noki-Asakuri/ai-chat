import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import { env } from "@/env";
import { logger } from "@/lib/axiom/logger";

import { registerAiChatRoutes } from "./routes/ai-chat";

type ServerState = {
  serverStartedAt: number;
  shuttingDown: boolean;
  activeRequests: number;
  activeStreams: number;
  commitSha: string;
};

export type ServerApp = {
  app: Hono;
  state: ServerState;
};

export function createServerApp(options: { commitSha: string }): ServerApp {
  const state: ServerState = {
    serverStartedAt: Date.now(),
    shuttingDown: false,
    activeRequests: 0,
    activeStreams: 0,
    commitSha: options.commitSha,
  };

  const app = new Hono();
  const requestLogger = honoLogger();

  app.use(requestId());
  app.use("*", (ctx, next) => {
    if (ctx.req.path === "/health") {
      return next();
    }

    return requestLogger(ctx, next);
  });
  app.use(secureHeaders());

  // Graceful-drain aware middleware: block new requests during shutdown and track in-flight work
  app.use("*", async (ctx, next) => {
    if (state.shuttingDown) {
      const message = "Server is shutting down, please retry in a moment.";
      return ctx.json({ message: { message } }, 503);
    }

    state.activeRequests++;

    try {
      await next();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error("[Server] Request middleware caught error", {
        requestId: ctx.get("requestId"),
        path: ctx.req.path,
        method: ctx.req.method,
        message: err.message,
        stack: err.stack,
      });

      throw error;
    } finally {
      state.activeRequests = Math.max(0, state.activeRequests - 1);
    }
  });

  app.use(
    "/api/*",
    cors({
      origin: env.NODE_ENV === "production" ? "https://chat.asakuri.me" : "http://localhost:3000",
      allowMethods: ["POST", "GET", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type", "Cookie"],
      exposeHeaders: ["Content-Type", "X-Request-Id", "X-Stream-Id"],
      credentials: true,
      maxAge: 604_800,
    }),
  );

  app.get("/", (ctx) => {
    const payload = {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: new Date(state.serverStartedAt).toISOString(),
      commitSha: state.commitSha,
      shuttingDown: state.shuttingDown,
      inFlight: state.activeRequests + state.activeStreams,
    };
    return ctx.json(payload);
  });

  // Health check route for Docker/K8s
  app.get("/health", (ctx) => ctx.text("OK"));

  registerAiChatRoutes(app);

  process.on("unhandledRejection", (reason) => {
    logger.error("[Server] Unhandled Rejection", { reason });
  });

  process.on("uncaughtException", (err) => {
    logger.error("[Server] Uncaught Exception", { message: err.message, stack: err.stack });
  });

  process.on("SIGTERM", () => {
    state.shuttingDown = true;
    logger.info("[Server] SIGTERM received. Draining in-flight requests...", {
      inFlight: state.activeRequests + state.activeStreams,
    });

    const start = Date.now();
    const deadlineMs = 30_000;

    const interval = setInterval(() => {
      const inFlight = state.activeRequests + state.activeStreams;
      if (inFlight === 0 || Date.now() - start > deadlineMs) {
        clearInterval(interval);
        logger.info("[Server] Exiting process", { inFlight, waitedMs: Date.now() - start });
        process.exit(0);
      }
    }, 250);
  });

  return { app, state };
}
