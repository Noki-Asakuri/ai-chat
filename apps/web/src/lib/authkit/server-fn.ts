import { DEFAULT_AUTH_SESSION_COOKIE_NAME } from "@ai-chat/auth-session";

import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie } from "@tanstack/react-start/server";

import { getAuthkit } from "@workos/authkit-tanstack-react-start";
import { DEFAULT_STORAGE_KEY } from "convex-helpers/react/sessions";

export const terminateSession = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId?: string; returnTo?: string }) => data)
  .handler(async ({ data: { sessionId, returnTo } }) => {
    if (!sessionId) throw redirect({ to: returnTo, throw: true, reloadDocument: true });

    const authKit = await getAuthkit();
    const logoutUrl = authKit.getWorkOS().userManagement.getLogoutUrl({ sessionId, returnTo });

    deleteCookie(DEFAULT_STORAGE_KEY);
    deleteCookie(DEFAULT_AUTH_SESSION_COOKIE_NAME);

    console.log("[Auth] Terminated session", { sessionId, returnTo, logoutUrl });
    await fetch(logoutUrl, { credentials: "include", cache: "no-store" });

    throw redirect({ to: returnTo, throw: true, reloadDocument: true });
  });
