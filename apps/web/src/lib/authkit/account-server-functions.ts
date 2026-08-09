import { createServerFn } from "@tanstack/react-start";
import {
  checkRecentAuth,
  getAuth,
  getAuthkit,
} from "@workos/authkit-tanstack-react-start";

import { env } from "@/env";

const RECENT_AUTH_MAX_AGE_SECONDS = 300;

type UpdateAccountProfileInput = {
  firstName: string;
  lastName: string;
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
  .validator((data: UpdateAccountProfileInput) => data)
  .handler(async ({ data }) => {
    const auth = await getAuth();
    if (!auth?.user) throw new Error("Not authenticated");

    const firstName = normalizeEmptyToUndefined(data.firstName);
    const lastName = normalizeEmptyToUndefined(data.lastName);
    const authKit = await getAuthkit();
    const updatedUser = await authKit.getWorkOS().userManagement.updateUser({
      userId: auth.user.id,
      firstName,
      lastName,
    });

    return { user: updatedUser };
  });

type StartEmailChangeInput = {
  email: string;
};

export const startAccountEmailChange = createServerFn({ method: "POST" })
  .validator((data: StartEmailChangeInput) => data)
  .handler(async ({ data }) => {
    const auth = await getAuth();
    if (!auth.user) throw new Error("Not authenticated");

    const recentAuth = await checkRecentAuth({ data: { maxAge: RECENT_AUTH_MAX_AGE_SECONDS } });
    if (recentAuth.isStale) return { status: "reauth_required" };

    const email = cleanFormString(data.email);
    if (email.length === 0 || email === auth.user.email) {
      throw new Error("Enter a different email address");
    }

    const response = await fetch(
      `https://api.workos.com/user_management/users/${encodeURIComponent(auth.user.id)}/email_change/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WORKOS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ new_email: email }),
      },
    );

    if (!response.ok) throw new Error("Failed to send email change code");

    return { status: "code_sent" };
  });

type ConfirmEmailChangeInput = {
  code: string;
};

export const confirmAccountEmailChange = createServerFn({ method: "POST" })
  .validator((data: ConfirmEmailChangeInput) => data)
  .handler(async ({ data }) => {
    const auth = await getAuth();
    if (!auth.user) throw new Error("Not authenticated");

    const recentAuth = await checkRecentAuth({ data: { maxAge: RECENT_AUTH_MAX_AGE_SECONDS } });
    if (recentAuth.isStale) return { status: "reauth_required" };

    const code = cleanFormString(data.code);
    if (code.length === 0) throw new Error("Enter the verification code");

    const response = await fetch(
      `https://api.workos.com/user_management/users/${encodeURIComponent(auth.user.id)}/email_change/confirm`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WORKOS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      },
    );

    if (!response.ok) throw new Error("Invalid or expired email change code");

    return { status: "email_changed" };
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
      .userManagement.listSessions(auth.user.id, { limit: 100 });

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
  .validator((data: RevokeAccountSessionInput) => data)
  .handler(async ({ data }) => {
    const auth = await getAuth();

    if (!auth.user) {
      throw new Error("Not authenticated");
    }

    if (data.sessionId === auth.sessionId) {
      throw new Error("Cannot revoke the current session");
    }

    const recentAuth = await checkRecentAuth({ data: { maxAge: RECENT_AUTH_MAX_AGE_SECONDS } });
    if (recentAuth.isStale) return { status: "reauth_required" };

    const authKit = await getAuthkit();
    const sessions = await authKit
      .getWorkOS()
      .userManagement.listSessions(auth.user.id, { limit: 100 });
    const ownsSession = sessions.data.some(
      (session) => session.id === data.sessionId && session.userId === auth.user.id,
    );
    if (!ownsSession) throw new Error("Session not found");

    await authKit.getWorkOS().userManagement.revokeSession({ sessionId: data.sessionId });

    return { status: "revoked" };
  });
