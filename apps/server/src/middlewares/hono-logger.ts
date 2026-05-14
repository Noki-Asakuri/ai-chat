import { createMiddleware } from "hono/factory";
import { logger } from "hono/logger";

const honoLogger = logger();

export const honoLoggerMiddleware = createMiddleware(function (ctx, next) {
  // We only log API request, anything else is ignore
  if (ctx.req.path.startsWith("/api")) {
    return honoLogger(ctx, next);
  }

  return next();
});
