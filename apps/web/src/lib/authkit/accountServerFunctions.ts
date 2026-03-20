import { createServerFn } from "@tanstack/react-start";
import { getAuth, getAuthkit } from "@workos/authkit-tanstack-react-start";

type UpdateAccountProfileInput = {
  firstName: string;
  lastName: string;
  email: string;
};

function cleanFormString(value: string): string {
  return value.trim();
}

function normalizeEmptyToUndefined(value: string): string | undefined {
  const trimmed = cleanFormString(value);
  return trimmed.length === 0 ? undefined : trimmed;
}

function getErrorDetails(error: unknown): {
  name: string;
  message: string;
  code: string | null;
} {
  if (error instanceof Error) {
    const hasCode = "code" in error;
    const code = hasCode && typeof error.code === "string" ? error.code : null;

    return {
      name: error.name,
      message: error.message,
      code,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      code: null,
    };
  }

  return {
    name: "UnknownError",
    message: "Unknown error",
    code: null,
  };
}

export const updateAccountProfile = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateAccountProfileInput) => data)
  .handler(async ({ data }) => {
    const auth = await getAuth();
    if (!auth?.user) throw new Error("Not authenticated");

    const firstName = normalizeEmptyToUndefined(data.firstName);
    const lastName = normalizeEmptyToUndefined(data.lastName);
    const email = cleanFormString(data.email);

    const authKit = await getAuthkit();
    const updatedUser = await authKit.getWorkOS().userManagement.updateUser({
      userId: auth.user.id,
      email,
      firstName,
      lastName,
    });

    return { user: updatedUser };
  });

export type AccountSession = {
  id: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  authMethod:
    | "cross_app_auth"
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
  let currentUserId: string | null = null;
  let currentSessionId: string | null = null;

  try {
    const auth = await getAuth();
    if (!auth.user) throw new Error("Not authenticated");

    currentUserId = auth.user.id;
    currentSessionId = auth.sessionId ?? null;

    const authKit = await getAuthkit();
    const sessions = await authKit
      .getWorkOS()
      .userManagement.listSessions(auth.user.id, { limit: 50 });

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
  } catch (error) {
    const details = getErrorDetails(error);

    console.error("[AuthKit] Failed to list account sessions", {
      userId: currentUserId,
      sessionId: currentSessionId,
      errorName: details.name,
      errorCode: details.code,
      errorMessage: details.message,
    });

    if (details.message === "Not authenticated") {
      throw new Error("Not authenticated");
    }

    throw new Error("Failed to load active sessions");
  }
});

type RevokeAccountSessionInput = {
  sessionId: string;
};

export const revokeAccountSession = createServerFn({ method: "POST" })
  .inputValidator((data: RevokeAccountSessionInput) => data)
  .handler(async ({ data }) => {
    const auth = await getAuth();

    if (!auth.user) {
      throw new Error("Not authenticated");
    }

    if (data.sessionId === auth.sessionId) {
      throw new Error("Cannot revoke the current session");
    }

    const authKit = await getAuthkit();
    await authKit.getWorkOS().userManagement.revokeSession({ sessionId: data.sessionId });

    return { ok: true };
  });
