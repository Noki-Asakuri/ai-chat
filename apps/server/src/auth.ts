import { decryptAuthSession, readCookieFromHeader } from "@ai-chat/auth-session";

import { env } from "./env";

export type ServerAuthContext = {
  userId: string;
  accessToken: string;
};

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
