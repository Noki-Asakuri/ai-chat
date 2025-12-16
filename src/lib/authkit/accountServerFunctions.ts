import { createServerFn } from "@tanstack/react-start";

import { getSessionFromCookie, saveSession, withAuth } from "./ssr/session";
import { getWorkOS } from "./ssr/workos";

type UpdateAccountProfileInput = {
  firstName: string;
  lastName: string;
  email: string;
  avatarKey?: string | null;
};

function cleanFormString(value: string): string {
  return value.trim();
}

function normalizeEmptyToUndefined(value: string): string | undefined {
  const trimmed = cleanFormString(value);
  return trimmed.length === 0 ? undefined : trimmed;
}

export const updateAccountProfile = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateAccountProfileInput) => data)
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie();
    if (!session?.user) {
      throw new Error("Not authenticated");
    }

    const firstName = normalizeEmptyToUndefined(data.firstName);
    const lastName = normalizeEmptyToUndefined(data.lastName);
    const email = cleanFormString(data.email);

    const metadata: Record<string, string | null> = { ...session.user.metadata };

    if (data.avatarKey !== undefined) {
      metadata.avatarKey = data.avatarKey;
    }

    const updatedUser = await getWorkOS().userManagement.updateUser({
      userId: session.user.id,
      email,
      firstName,
      lastName,
      metadata,
    });

    await saveSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: updatedUser,
      impersonator: session.impersonator,
    });

    return { user: updatedUser };
  });

export type AccountSession = {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  authMethod:
    | "external_auth"
    | "impersonation"
    | "magic_code"
    | "migrated_session"
    | "oauth"
    | "passkey"
    | "password"
    | "sso"
    | "unknown";
  status: "active" | "expired" | "revoked";
  expiresAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const listAccountSessions = createServerFn({ method: "GET" }).handler(async () => {
  const { user } = await withAuth();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const sessions = await getWorkOS().userManagement.listSessions(user.id, { limit: 50 });

  const data: Array<AccountSession> = [];
  for (const session of sessions.data) {
    data.push({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      authMethod: session.authMethod,
      status: session.status,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  }

  return { sessions: data };
});

type RevokeAccountSessionInput = {
  sessionId: string;
};

export const revokeAccountSession = createServerFn({ method: "POST" })
  .inputValidator((data: RevokeAccountSessionInput) => data)
  .handler(async ({ data }) => {
    const { sessionId: currentSessionId, user } = await withAuth();
    if (!user || !currentSessionId) {
      throw new Error("Not authenticated");
    }

    if (data.sessionId === currentSessionId) {
      throw new Error("Cannot revoke the current session");
    }

    await getWorkOS().userManagement.revokeSession({ sessionId: data.sessionId });
    return { ok: true };
  });