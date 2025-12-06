import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { useConvex } from "convex/react";
import { useEffect, useRef } from "react";

import { updateSession, verifyAccessToken, withAuth } from "@/lib/authkit/ssr/session";

async function getNewAccessToken() {
  console.log("[Server] Refreshing access token at", new Date());
  const { session } = await updateSession(getRequest());

  return session.accessToken!;
}

const refreshAccessToken = createServerFn({ method: "GET" }).handler(async () => {
  console.log("[Server] Received request to refresh token at", new Date());

  const { accessToken } = await withAuth();
  if (!accessToken) return getNewAccessToken();

  const isValid = await verifyAccessToken(accessToken);
  if (isValid) return accessToken;

  return getNewAccessToken();
});

export function AuthProviders({ children }: { children: React.ReactNode }) {
  const client = useConvex();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    async function refresh() {
      console.log("[Client] Refreshing access token at", new Date());
      try {
        const token = await refreshAccessToken();
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
