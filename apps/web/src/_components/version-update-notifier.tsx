import { DownloadIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useVersionWatcher } from "@/lib/hooks/use-version-watcher";
import { tryCatchSync } from "@/lib/utils";

const SNOOZE_UNTIL_STORAGE_KEY = "versionUpdateSnoozeUntilMs";
const SESSION_SNOOZE_STORAGE_KEY = "versionUpdateSnoozedForSession";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const snoozeStoreListeners = new Set<() => void>();

function getSnoozeSnapshot() {
  if (typeof window === "undefined") return "0:";

  const [isSnoozedForSession] = tryCatchSync(
    () => window.sessionStorage.getItem(SESSION_SNOOZE_STORAGE_KEY) === "true",
  );
  const [storedSnoozeUntilMs] = tryCatchSync(() => {
    const value = window.localStorage.getItem(SNOOZE_UNTIL_STORAGE_KEY);
    return value && Number.isFinite(Number(value)) ? value : "";
  });

  return `${isSnoozedForSession === true ? "1" : "0"}:${storedSnoozeUntilMs ?? ""}`;
}

function getServerSnoozeSnapshot() {
  return "0:";
}

function subscribeToSnoozeStore(onStoreChange: () => void) {
  function handleStorageChange(event: StorageEvent) {
    if (event.key === SNOOZE_UNTIL_STORAGE_KEY || event.key === SESSION_SNOOZE_STORAGE_KEY) {
      onStoreChange();
    }
  }

  snoozeStoreListeners.add(onStoreChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    snoozeStoreListeners.delete(onStoreChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function notifySnoozeStoreListeners() {
  for (const listener of snoozeStoreListeners) listener();
}

export function VersionUpdateNotifier() {
  const isNewVersionAvailable = useVersionWatcher();
  const snoozeSnapshot = useSyncExternalStore(
    subscribeToSnoozeStore,
    getSnoozeSnapshot,
    getServerSnoozeSnapshot,
  );
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false);
  const [isSnoozeDialogOpen, setIsSnoozeDialogOpen] = useState(false);
  const separatorIndex = snoozeSnapshot.indexOf(":");
  const isSnoozedForSession = snoozeSnapshot.startsWith("1:");
  const storedSnoozeUntilMs = Number(snoozeSnapshot.slice(separatorIndex + 1));
  const snoozedUntilMs = storedSnoozeUntilMs > 0 ? storedSnoozeUntilMs : null;

  useEffect(() => {
    if (snoozedUntilMs === null) return;

    const timeoutId = setTimeout(
      () => {
        tryCatchSync(() => {
          window.localStorage.removeItem(SNOOZE_UNTIL_STORAGE_KEY);
        });
        notifySnoozeStoreListeners();
      },
      Math.max(0, snoozedUntilMs - Date.now()),
    );

    return () => clearTimeout(timeoutId);
  }, [snoozedUntilMs]);

  function handleSessionSnooze() {
    tryCatchSync(() => {
      window.sessionStorage.setItem(SESSION_SNOOZE_STORAGE_KEY, "true");
    });
    setIsSnoozeDialogOpen(false);
    notifySnoozeStoreListeners();
  }

  function handleDaySnooze() {
    const snoozedUntilMs = Date.now() + ONE_DAY_MS;

    tryCatchSync(() => {
      window.localStorage.setItem(SNOOZE_UNTIL_STORAGE_KEY, String(snoozedUntilMs));
    });
    setIsSnoozeDialogOpen(false);
    notifySnoozeStoreListeners();
  }

  if (!isNewVersionAvailable || isSnoozedForSession || snoozedUntilMs !== null) {
    return null;
  }

  return (
    <>
      <Badge
        variant="secondary"
        className="h-8 w-full gap-0 rounded-md border-primary/20 bg-primary/10 p-0 text-primary"
      >
        <Button
          variant="none"
          size="none"
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 px-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => setIsRefreshDialogOpen(true)}
        >
          <DownloadIcon data-icon="inline-start" />
          <span className="truncate">Update available</span>
        </Button>

        <Button
          variant="none"
          size="none"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center outline-none hover:bg-primary/10 focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Snooze update reminder"
          onClick={() => setIsSnoozeDialogOpen(true)}
        >
          <XIcon />
        </Button>
      </Badge>

      <AlertDialog open={isRefreshDialogOpen} onOpenChange={setIsRefreshDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <RefreshCwIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Update available</AlertDialogTitle>
            <AlertDialogDescription>
              Refresh the page now to load the latest version of AI Chat?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.location.reload()}>Refresh</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isSnoozeDialogOpen} onOpenChange={setIsSnoozeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Snooze update reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              Hide the update badge for the rest of this session or remind you again in one day.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="secondary" onClick={handleSessionSnooze}>
              This session
            </AlertDialogAction>
            <AlertDialogAction onClick={handleDaySnooze}>1 day</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
