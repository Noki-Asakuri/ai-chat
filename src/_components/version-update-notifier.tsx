import { useEffect, useRef } from "react";

import { showVersionUpdateToast } from "@/components/toasts/version-update-toast";

import { useVersionWatcher } from "@/lib/hooks/use-version-watcher";
import { tryCatchSync } from "@/lib/utils";

const SNOOZE_UNTIL_STORAGE_KEY = "versionUpdateSnoozeUntilMs";
const SNOOZE_DURATION_MS = 30 * 60 * 1000;

export function VersionUpdateNotifier() {
  const isNewVersionAvailable = useVersionWatcher();

  const toastIdRef = useRef<string | number | null>(null);
  const snoozeTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isNewVersionAvailable) return;
    if (typeof window === "undefined") return;

    function readSnoozedUntilMs(): number {
      const [value] = tryCatchSync(() => {
        const value = window.localStorage.getItem(SNOOZE_UNTIL_STORAGE_KEY);
        if (!value) return 0;

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      });

      return value ?? 0;
    }

    function writeSnoozedUntilMs(untilMs: number) {
      tryCatchSync(() => {
        window.localStorage.setItem(SNOOZE_UNTIL_STORAGE_KEY, String(untilMs));
      });
    }

    function clearSnoozeTimer() {
      if (!snoozeTimeoutIdRef.current) return;
      clearTimeout(snoozeTimeoutIdRef.current);
      snoozeTimeoutIdRef.current = null;
    }

    function scheduleAfterSnooze(untilMs: number) {
      clearSnoozeTimer();
      const delayMs = untilMs - Date.now();
      if (delayMs <= 0) return;

      // We intentionally use setTimeout to re-prompt after "Remind later"
      // without requiring a new version check to occur.
      snoozeTimeoutIdRef.current = setTimeout(() => {
        toastIdRef.current = null;
        maybeShowToast();
      }, delayMs);
    }

    function maybeShowToast() {
      if (toastIdRef.current !== null) return;

      const snoozedUntilMs = readSnoozedUntilMs();
      if (Date.now() < snoozedUntilMs) {
        scheduleAfterSnooze(snoozedUntilMs);
        return;
      }

      const toastId = showVersionUpdateToast({
        onRefresh: () => {
          window.location.reload();
        },
        onRemindLater: () => {
          const untilMs = Date.now() + SNOOZE_DURATION_MS;
          writeSnoozedUntilMs(untilMs);
          scheduleAfterSnooze(untilMs);
        },
        onDismiss: () => {
          toastIdRef.current = null;
        },
      });

      toastIdRef.current = toastId;
    }

    maybeShowToast();

    return () => {
      clearSnoozeTimer();
    };
  }, [isNewVersionAvailable]);

  return null;
}
