import type { Impersonator, User } from "@workos-inc/node";
import { sealData, unsealData } from "iron-session";

export const DEFAULT_AUTH_SESSION_COOKIE_NAME = "wos-session";

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
  impersonator?: Impersonator;
};

export function getAuthSessionCookieName(cookieName?: string | null): string {
  return cookieName && cookieName.length > 0 ? cookieName : DEFAULT_AUTH_SESSION_COOKIE_NAME;
}

export async function decryptAuthSession(
  encryptedSession: string,
  cookiePassword: string,
): Promise<Session> {
  return unsealData<Session>(encryptedSession, { password: cookiePassword });
}

export async function encryptAuthSession(
  session: Session,
  cookiePassword: string,
): Promise<string> {
  return sealData(session, { password: cookiePassword, ttl: 0 });
}

export function readCookieFromHeader(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) return null;

  const cookieEntries = cookieHeader.split(";");
  for (const entry of cookieEntries) {
    const [name, ...rawValueParts] = entry.trim().split("=");
    if (name !== cookieName) continue;

    const rawValue = rawValueParts.join("=");
    return rawValue.length > 0 ? decodeURIComponent(rawValue) : null;
  }

  return null;
}
