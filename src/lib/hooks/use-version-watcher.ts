// src/hooks/useVersionWatcher.ts
import { useState, useEffect, useRef } from "react";

const INTERVAL_IN_MS = 5 * 60 * 1000;

// The hook's job is simple: return true if a new version is available.
export function useVersionWatcher() {
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);
  const currentVersion = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

  const running = useRef(false);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't run this on the server or in local dev.
    if (typeof window === "undefined" || process.env.NODE_ENV !== "production") {
      return;
    }

    async function checkVersion() {
      if (running.current) return;
      running.current = true;

      try {
        const response = await fetch("/api/version");
        const data = (await response.json()) as { version: string | undefined };
        const latestVersion = data.version;

        if (latestVersion && latestVersion !== currentVersion) {
          setIsNewVersionAvailable(true);
          if (intervalId.current) {
            clearInterval(intervalId.current);
            intervalId.current = null;
          }
        }
      } catch (error) {
        // If the fetch fails, we'll just silently try again later.
        console.error("Failed to check for new version:", error);
      }

      running.current = false;
    }

    void checkVersion();
    intervalId.current = setInterval(() => void checkVersion(), INTERVAL_IN_MS);

    return () => {
      if (intervalId.current) clearInterval(intervalId.current);
      intervalId.current = null;
    };
  }, [currentVersion]);

  return isNewVersionAvailable;
}
