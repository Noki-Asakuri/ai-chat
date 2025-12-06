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
  const timeoutRef = useRef<number | null>(null);

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

    const lastRunStr = localStorage.getItem("last_auth_refresh_time");
    const lastRun = lastRunStr ? parseInt(lastRunStr, 10) : 0;
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;
    const fourMinutes = 4 * 60 * 1000;
    const fiveMinutes = 5 * 60 * 1000;

    if (timeSinceLastRun > fourMinutes) {
      // If last run was more than 4 mins ago (or never), run immediately
      console.log("[Client] Last refresh was > 4 mins ago, refreshing immediately");
      void refresh();
      startInterval();
    } else {
      // Otherwise schedule for the remainder of the 5 minute window
      const delay = Math.max(0, fiveMinutes - timeSinceLastRun);
      console.log(`[Client] Scheduling refresh in ${Math.round(delay / 1000)}s`);

      timeoutRef.current = window.setTimeout(() => {
        void refresh();
        startInterval();
      }, delay);
    }

    return () => {
      console.log("[Client] Clearing interval and timeout");

      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return children;
}
