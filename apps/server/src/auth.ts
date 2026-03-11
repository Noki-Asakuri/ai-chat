import { decodeJwt } from "jose";
import {
  decryptAuthSession,
  getAuthSessionCookieName,
  readCookieFromHeader,
} from "@ai-chat/auth-session";

import type { AccessToken } from "@workos-inc/node";

import { env } from "./env";

export type ServerAuthContext = {
  userId: string;
  sessionId: string;
};

export async function getAuthContextFromCookieHeader(options: {
  cookieHeader: string | undefined;
}): Promise<ServerAuthContext> {
  const cookieName = getAuthSessionCookieName(env.WORKOS_COOKIE_NAME);
  const wosSessionEncrypted = readCookieFromHeader(options.cookieHeader, cookieName) ?? "";

  const wosSession = await decryptAuthSession(wosSessionEncrypted, env.WORKOS_COOKIE_PASSWORD);
  const userId = wosSession.user.id;

  const decoded = decodeJwt<AccessToken>(wosSession.accessToken);
  const sessionId = decoded.sid;

  if (!userId || !sessionId) {
    throw new Error("Unauthenticated");
  }

  return { userId, sessionId };
}
