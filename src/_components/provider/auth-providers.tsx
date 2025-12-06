import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useEffect, useRef } from "react";

import { updateSession } from "@/lib/authkit/ssr/session";

const refreshAccessToken = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  console.log("[Server] Refreshing access token at", new Date());
  await updateSession(getRequest());
});

export function AuthProviders({ children }: { children: React.ReactNode }) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    async function refresh() {
      console.log("[Client] Refreshing access token at", new Date());
      try {
        await refreshAccessToken();
      } catch (err) {
        console.error("[Client] refresh failed", err);
      }
    }

    // Then schedule to run every 5 minutes from mount
    intervalRef.current = window.setInterval(refresh, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return children;
}
