import {
  authenticateRequestSession,
  type AuthSessionConfig,
  type AuthSessionPersistence,
  type AuthenticatedRequestSession,
} from "@ai-chat/auth-session";

import { createMiddleware } from "hono/factory";

import { env } from "./env";
import { logger } from "./lib/logger";
import { cacheRedis } from "./redis";

const AUTH_SESSION_TTL_SECONDS = 60 * 60;
const AUTH_SESSION_CACHE_PREFIX = `${env.NODE_ENV}:auth-session`;

function shortenToken(token: string | null): string | null {
  if (!token) return null;
  return token.slice(0, 12);
}

export type ServerAuthContext = {
  userId: string;
  getAccessToken: () => Promise<string>;
  getPendingSetCookieHeader: () => string | null;
  flushPendingSetCookieHeader: () => string | null;
};

declare module "hono" {
  interface ContextVariableMap {
    auth: ServerAuthContext;
  }
}

function getAuthSessionConfig(): AuthSessionConfig {
  return {
    apiKey: env.WORKOS_API_KEY,
    clientId: env.WORKOS_CLIENT_ID,
    cookiePassword: env.WORKOS_COOKIE_PASSWORD,
    cookieDomain: env.WORKOS_COOKIE_DOMAIN,
    cookieMaxAge: env.WORKOS_COOKIE_MAX_AGE,
    cookieName: env.WORKOS_COOKIE_NAME,
    cookieSameSite: env.WORKOS_COOKIE_SAME_SITE,
  };
}

function toServerAuthContext(session: AuthenticatedRequestSession): ServerAuthContext {
  return {
    userId: session.userId,
    getAccessToken: session.getAccessToken,
    getPendingSetCookieHeader: session.getPendingSetCookieHeader,
    flushPendingSetCookieHeader: session.flushPendingSetCookieHeader,
  };
}

function getSessionCacheKey(sessionId: string): string {
  return `${AUTH_SESSION_CACHE_PREFIX}:sid:${sessionId}`;
}

function getRefreshTokenCacheKey(refreshToken: string): string {
  return `${AUTH_SESSION_CACHE_PREFIX}:refresh:${refreshToken}`;
}

function applySessionHeaderToContext(
  ctx: Parameters<typeof authenticate>[0],
  headerValue: string | null,
) {
  if (!headerValue) return;
  ctx.header("Set-Cookie", headerValue, { append: true });
}

const authSessionPersistence: AuthSessionPersistence = {
  async resolveLatestSessionData(options) {
    if (options.sessionId) {
      const bySessionId = await cacheRedis.get(getSessionCacheKey(options.sessionId));
      if (bySessionId) {
        logger.info("[Auth Session] Restored latest session from session alias", {
          refreshTokenPrefix: shortenToken(options.refreshToken),
          sessionId: options.sessionId,
          userId: options.userId,
        });
        return bySessionId;
      }
    }

    if (options.refreshToken) {
      const byRefreshToken = await cacheRedis.get(getRefreshTokenCacheKey(options.refreshToken));
      if (byRefreshToken) {
        logger.info("[Auth Session] Restored latest session from refresh alias", {
          refreshTokenPrefix: shortenToken(options.refreshToken),
          sessionId: options.sessionId,
          userId: options.userId,
        });
        return byRefreshToken;
      }
    }

    logger.debug("[Auth Session] No persisted session alias found", {
      refreshTokenPrefix: shortenToken(options.refreshToken),
      sessionId: options.sessionId,
      userId: options.userId,
    });

    return null;
  },
  async persistLatestSessionData(options) {
    const operations: Array<Promise<unknown>> = [];

    if (options.sessionId) {
      operations.push(
        cacheRedis.set(
          getSessionCacheKey(options.sessionId),
          options.sessionData,
          "EX",
          AUTH_SESSION_TTL_SECONDS,
        ),
      );
    }

    if (options.previousSessionId && options.previousSessionId !== options.sessionId) {
      operations.push(cacheRedis.del(getSessionCacheKey(options.previousSessionId)));
    }

    if (
      options.previousRefreshToken &&
      options.previousRefreshToken !== options.session.refreshToken
    ) {
      operations.push(cacheRedis.del(getRefreshTokenCacheKey(options.previousRefreshToken)));
    }

    operations.push(
      cacheRedis.set(
        getRefreshTokenCacheKey(options.session.refreshToken),
        options.sessionData,
        "EX",
        AUTH_SESSION_TTL_SECONDS,
      ),
    );

    await Promise.all(operations);

    logger.info("[Auth Session] Persisted latest session alias", {
      previousRefreshTokenPrefix: shortenToken(options.previousRefreshToken),
      previousSessionId: options.previousSessionId,
      refreshTokenPrefix: shortenToken(options.session.refreshToken),
      sessionId: options.sessionId,
      userId: options.userId,
    });
  },
  async clearLatestSessionData(options) {
    const operations: Array<Promise<unknown>> = [];

    if (options.sessionId) {
      operations.push(cacheRedis.del(getSessionCacheKey(options.sessionId)));
    }

    if (options.refreshToken) {
      operations.push(cacheRedis.del(getRefreshTokenCacheKey(options.refreshToken)));
    }

    if (operations.length === 0) return;
    await Promise.all(operations);

    logger.info("[Auth Session] Cleared persisted session alias", {
      refreshTokenPrefix: shortenToken(options.refreshToken),
      sessionId: options.sessionId,
      userId: options.userId,
    });
  },
};

export async function getAuthContextFromRequest(request: Request): Promise<ServerAuthContext> {
  const authResult = await authenticateRequestSession({
    request,
    config: getAuthSessionConfig(),
    persistence: authSessionPersistence,
  });

  if (!authResult.authenticated) {
    throw new Error("Unauthenticated");
  }

  return toServerAuthContext(authResult.session);
}

export const authenticate = createMiddleware(async function authenticate(ctx, next) {
  const requestId = ctx.get("requestId");
  const authSessionConfig = getAuthSessionConfig();

  const authResult = await authenticateRequestSession({
    request: ctx.req.raw,
    config: authSessionConfig,
    persistence: authSessionPersistence,
  });

  if (!authResult.authenticated) {
    applySessionHeaderToContext(ctx, authResult.clearSessionHeader);

    logger.warn("[Auth] Request rejected (unauthenticated)", {
      requestId,
      path: ctx.req.path,
      method: ctx.req.method,
      message: "Unauthenticated",
    });

    return Response.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }

  const auth = toServerAuthContext(authResult.session);
  ctx.set("auth", auth);

  try {
    await next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    applySessionHeaderToContext(ctx, auth.flushPendingSetCookieHeader());

    logger.warn("[Auth] Request failed after authentication", {
      requestId,
      path: ctx.req.path,
      method: ctx.req.method,
      message: err.message,
    });

    throw error;
  }

  applySessionHeaderToContext(ctx, auth.flushPendingSetCookieHeader());
});
