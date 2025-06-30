// src/hooks/useVersionWatcher.ts
import { useState, useEffect } from "react";

// The hook's job is simple: return true if a new version is available.
export function useVersionWatcher(intervalInMs = 60000) {
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);
  const currentVersion = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

  useEffect(
    function versionCheck() {
      // Don't run this on the server or in local dev.
      if (typeof window === "undefined" || process.env.NODE_ENV !== "production") {
        return;
      }

      const intervalId = setInterval(() => {
        async function checkVersion() {
          try {
            const response = await fetch("/api/version");
            const data = (await response.json()) as { version: string | undefined };
            const latestVersion = data.version;

            if (latestVersion && latestVersion !== currentVersion) {
              setIsNewVersionAvailable(true);
              clearInterval(intervalId);
            }
          } catch (error) {
            // If the fetch fails, we'll just silently try again later.
            console.error("Failed to check for new version:", error);
          }
        }

        void checkVersion();
      }, intervalInMs);

      return () => {
        clearInterval(intervalId);
      };
    },
    [currentVersion, intervalInMs],
  );

  return isNewVersionAvailable;
}
