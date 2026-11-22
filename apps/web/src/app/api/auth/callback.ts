import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { getConfig, sessionEncryption } from "@workos/authkit-session";
import { getAuthkit, handleCallbackRoute } from "@workos/authkit-tanstack-react-start";
import { z } from "zod/v4";

import {
  AUTH_CALLBACK_RETRY_COOKIE_MAX_AGE,
  AUTH_CALLBACK_RETRY_COOKIE_NAME,
  chooseCallbackErrorAction,
} from "@/lib/authkit/callback-recovery";
import { AUTH_ERROR_COOKIE_NAME, createAuthErrorDiagnostic } from "@/lib/authkit/error-diagnostic";
import { getSafeAuthReturnPath } from "@/lib/authkit/redirect";

const PKCE_STATE_TTL_SECONDS = 600;

const pkceStateSchema = z.object({ returnPathname: z.string().optional() });

async function isSignedIn(request: Request): Promise<boolean> {
  try {
    const authkit = await getAuthkit();
    const { auth } = await authkit.withAuth(request);
    return auth.user !== null;
  } catch {
    return false;
  }
}

async function readReturnPath(request: Request): Promise<string> {
  const state = new URL(request.url).searchParams.get("state");
  if (!state) return "/";

  try {
    const sealed = await sessionEncryption.unsealData(state, {
      password: getConfig("cookiePassword"),
      ttl: PKCE_STATE_TTL_SECONDS,
    });
    return getSafeAuthReturnPath(pkceStateSchema.safeParse(sealed).data?.returnPathname);
  } catch {
    return "/";
  }
}

const handleCallback = handleCallbackRoute({
  onError: async function ({ error, request }) {
    const secure = new URL(request.url).protocol === "https:";
    const action = chooseCallbackErrorAction({
      error,
      signedIn: await isSignedIn(request),
      alreadyRetried: getCookie(AUTH_CALLBACK_RETRY_COOKIE_NAME) !== undefined,
      returnPath: await readReturnPath(request),
    });

    if (action.type === "redirect") {
      if (action.markRetry) {
        setCookie(AUTH_CALLBACK_RETRY_COOKIE_NAME, "1", {
          path: "/api/auth/callback",
          httpOnly: true,
          maxAge: AUTH_CALLBACK_RETRY_COOKIE_MAX_AGE,
          sameSite: "lax",
          secure,
        });
      }

      return Response.redirect(new URL(action.path, request.url), 302);
    }

    setCookie(AUTH_ERROR_COOKIE_NAME, JSON.stringify(createAuthErrorDiagnostic(error)), {
      path: "/auth/error",
      httpOnly: true,
      maxAge: 300,
      sameSite: "lax",
      secure,
    });

    return Response.redirect(new URL("/auth/error", request.url), 302);
  },
});

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: async function (context) {
        const alreadyRetried = getCookie(AUTH_CALLBACK_RETRY_COOKIE_NAME) !== undefined;
        const response = await handleCallback(context);
        const headers = new Headers(response.headers);
        // A cached or restored callback page would replay a sign-in code that is already spent.
        headers.set("Cache-Control", "no-store");

        if (alreadyRetried) deleteCookie(AUTH_CALLBACK_RETRY_COOKIE_NAME, { path: "/api/auth/callback" });

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      },
    },
  },
});
