import { decodeJwt } from "jose";

import { decryptSession } from "@/lib/authkit/ssr/session";
import type { AccessToken } from "@workos-inc/node";

export type ServerAuthContext = {
  userId: string;
  sessionId: string;
};

export async function getAuthContextFromCookieHeader(options: {
  cookieHeader: string | undefined;
}): Promise<ServerAuthContext> {
  const cookie = options.cookieHeader ?? "";
  const wosSessionEncrypted = cookie.match(/wos-session=([^;]+)/)?.[1] ?? "";

  const wosSession = await decryptSession(wosSessionEncrypted);
  const userId = wosSession.user.id;

  const decoded = decodeJwt<AccessToken>(wosSession.accessToken);
  const sessionId = decoded.sid;

  if (!userId || !sessionId) {
    throw new Error("Unauthenticated");
  }

  return { userId, sessionId };
}