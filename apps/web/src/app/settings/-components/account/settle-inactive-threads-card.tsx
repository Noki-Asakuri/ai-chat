import { api } from "@ai-chat/backend/convex/_generated/api";

import { useMutation } from "convex/react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Thread cleanup</CardTitle>
          <CardDescription>
            Settle completed or failed threads that have not been updated in the last 3 days.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
            Settle inactive threads
          </Button>
        </CardContent>
      </Card>

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
