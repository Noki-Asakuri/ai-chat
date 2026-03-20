import { encryptAuthSession, type Session } from "@ai-chat/auth-session";

import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start";

import { env } from "@/env";
import { setCookie } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute({
        onSuccess: async function (data) {
          const session: Session = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            user: data.user,
            impersonator: data.impersonator,
          };

          const encryptedSession = await encryptAuthSession(session, env.WORKOS_COOKIE_PASSWORD);

          setCookie("wos-session", encryptedSession, {
            path: "/",
            maxAge: 30 * 24 * 60 * 60, // 30 days
            httpOnly: true,
            sameSite: "lax",
            priority: "high",
            secure: import.meta.env.PROD,
            domain: env.WORKOS_COOKIE_DOMAIN,
          });
        },
      }),
    },
  },
});
