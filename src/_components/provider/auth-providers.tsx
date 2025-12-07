import { createServerFn } from "@tanstack/react-start";
import z from "zod";

import { useConvex } from "convex/react";
import { useEffect, useRef } from "react";

import { getSessionFromCookie, refreshSession } from "@/lib/authkit/ssr/session";

export const refreshAccessToken = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      source: z.literal(["client", "server"]),
      forceRefreshToken: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    console.log("[Server] Received request to refresh token at", new Date(), "from", data.source);

    const session = await getSessionFromCookie();
    if (!session) {
      console.log("[Server] No session found, returning null");
      return null;
    }

    const newSession = await refreshSession(session, data.forceRefreshToken);
    return newSession.accessToken;
  });

export function AuthProviders({ children }: { children: React.ReactNode }) {
  const client = useConvex();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    async function refresh() {
      console.debug("[Client] Refreshing access token at", new Date());
      try {
        // We always force refresh the token on the client to ensure we always have a valid token.
        const token = await refreshAccessToken({
          data: { source: "client", forceRefreshToken: true },
        });
        client.setAuth(async () => token);
        localStorage.setItem("last_auth_refresh_time", Date.now().toString());
      } catch (err) {
        console.error("[Client] refresh failed", err);
      }
    }

    const startInterval = () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(refresh, 5 * 60 * 1000);
    };

    void refresh();
    startInterval();

    return () => {
      console.log("[Client] Clearing interval and timeout");

      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return children;
}
