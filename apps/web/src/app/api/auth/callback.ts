import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";

import { AUTH_ERROR_COOKIE_NAME, createAuthErrorDiagnostic } from "@/lib/authkit/error-diagnostic";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute({
        onError: function ({ error, request }) {
          setCookie(AUTH_ERROR_COOKIE_NAME, JSON.stringify(createAuthErrorDiagnostic(error)), {
            path: "/auth/error",
            httpOnly: true,
            maxAge: 300,
            sameSite: "lax",
            secure: new URL(request.url).protocol === "https:",
          });

          return Response.redirect(new URL("/auth/error", request.url), 302);
        },
      }),
    },
  },
});
