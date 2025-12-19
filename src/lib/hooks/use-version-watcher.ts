import { createServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

const INTERVAL_IN_MS = 5 * 60 * 1000;

type VersionResponse = {
  version: string | null;
};

export const getLatestAppVersion = createServerFn({ method: "GET" }).handler(async () => {
  return {
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };
});

// The hook's job is simple: return true if a new version is available.
export function useVersionWatcher() {
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);
  const currentVersion = __APP_VERSION__;

  const running = useRef(false);
  const intervalId = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Don't run this on the server or in local dev.
    if (typeof window === "undefined" || !import.meta.env.PROD) {
      return;
    }

    async function checkVersion() {
      if (running.current) return;
      running.current = true;

      const data: VersionResponse = await getLatestAppVersion();
      const latestVersion = data.version;

      if (latestVersion && latestVersion !== currentVersion) {
        setIsNewVersionAvailable(true);
        if (intervalId.current) {
          clearInterval(intervalId.current);
          intervalId.current = null;
        }
      }

      running.current = false;
    }

    function onFocus() {
      void checkVersion();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    }

    void checkVersion();
    intervalId.current = setInterval(() => {
      void checkVersion();
    }, INTERVAL_IN_MS);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (intervalId.current) clearInterval(intervalId.current);
      intervalId.current = null;

      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [currentVersion]);

  return isNewVersionAvailable;
}
