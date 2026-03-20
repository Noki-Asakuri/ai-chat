import {
  decryptAuthSession,
  getAuthSessionCookieName,
  readCookieFromHeader,
} from "@ai-chat/auth-session";

import { env } from "./env";

export type ServerAuthContext = {
  userId: string;
  accessToken: string;
};

export async function getAuthContextFromCookieHeader(options: {
  cookieHeader: string | undefined;
}): Promise<ServerAuthContext> {
  const cookieName = getAuthSessionCookieName(env.WORKOS_COOKIE_NAME);
  const wosSessionEncrypted = readCookieFromHeader(options.cookieHeader, cookieName) ?? "";

  const wosSession = await decryptAuthSession(wosSessionEncrypted, env.WORKOS_COOKIE_PASSWORD);
  const userId = wosSession.user.id;
  const accessToken = wosSession.accessToken;

  if (!userId || !accessToken) {
    throw new Error("Unauthenticated");
  }

  return { userId, accessToken };
}
