/* oxlint-disable no-await-in-loop -- Cursor pagination is inherently sequential. */
import { api } from "@ai-chat/backend/convex/_generated/api";

import { useMutation } from "convex/react";
import { BrushCleaningIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function SettleInactiveThreadsCard() {
  const settleInactiveThreads = useMutation(api.functions.threads.settleInactiveThreads);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSettle() {
    startTransition(async () => {
      const before = Date.now() - THREE_DAYS_MS;
      let cursor: string | null = null;
      let settledCount = 0;

      try {
        while (true) {
          const result = await settleInactiveThreads({ before, cursor });
          settledCount += result.settledCount;

          if (result.isDone || result.continueCursor === null) break;
          cursor = result.continueCursor;
        }

        toast.success(
          settledCount === 0
            ? "No inactive threads to settle"
            : `Settled ${settledCount} thread${settledCount === 1 ? "" : "s"}`,
        );
        setDialogOpen(false);
      } catch (error) {
        toast.error("Failed to settle inactive threads", {
          description: error instanceof Error ? error.message : "An unknown error occurred",
        });
      }
    });
  }

  return (
    <>
      <section
        aria-labelledby="thread-cleanup-heading"
        className="flex flex-col gap-4 rounded-lg border bg-card p-4"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/14 text-amber-600 dark:text-amber-400">
            <BrushCleaningIcon aria-hidden="true" className="size-4.5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h3 id="thread-cleanup-heading" className="text-sm font-medium">
              Clean up now
            </h3>
            <p className="text-xs/relaxed text-muted-foreground">
              Settle every completed or failed thread that hasn't been updated in the last 3 days.
            </p>
          </div>
        </div>
        <div className="pl-12">
          <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            Settle inactive threads
          </Button>
        </div>
      </section>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Settle inactive threads?</AlertDialogTitle>
            <AlertDialogDescription>
              All completed or failed threads last updated more than 3 days ago will be settled. Any pinned
              threads included in this action will be unpinned.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={handleSettle}>
              {pending ? "Settling..." : "Settle threads"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
