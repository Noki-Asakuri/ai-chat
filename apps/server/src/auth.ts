import { decryptAuthSession, readCookieFromHeader } from "@ai-chat/auth-session";

import { createMiddleware } from "hono/factory";

import { env } from "./env";
import { logger } from "./lib/logger";

export type ServerAuthContext = {
  userId: string;
  accessToken: string;
};

declare module "hono" {
  interface ContextVariableMap {
    auth: ServerAuthContext;
  }
}

export async function getAuthContextFromCookieHeader(options: {
  cookieHeader: string | undefined;
}): Promise<ServerAuthContext> {
  const cookieName = "wos-session";
  const wosSessionEncrypted = readCookieFromHeader(options.cookieHeader, cookieName) ?? "";

  const wosSession = await decryptAuthSession(wosSessionEncrypted, env.WORKOS_COOKIE_PASSWORD);
  const accessToken = wosSession.accessToken;
  const userId = wosSession.user.id;

  if (!userId || !accessToken) {
    throw new Error("Unauthenticated");
  }

  return { userId, accessToken };
}

export const authenticate = createMiddleware(async function authenticate(ctx, next) {
  const requestId = ctx.get("requestId");

  try {
    const auth = await getAuthContextFromCookieHeader({ cookieHeader: ctx.req.header("Cookie") });
    ctx.set("auth", auth);

    await next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.warn("[Auth] Request rejected (unauthenticated)", {
      requestId,
      path: ctx.req.path,
      method: ctx.req.method,
      message: err.message,
    });

    return Response.json({ error: { message: "Error: Unauthenticated!" } }, { status: 401 });
  }
});
