import { api } from "@/convex/_generated/api";

import { useState, useTransition } from "react";
import { useNavigate } from "react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import type { Thread } from "@/lib/types";

type ThreadDeleteDialogProps = {
  threadId: Thread["_id"];
  title: Thread["title"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const convexClient = getConvexReactClient();

export function ThreadDeleteDialog({
  threadId,
  title,
  open,
  onOpenChange,
}: ThreadDeleteDialogProps) {
  const [pending, startTransition] = useTransition();

  const navigate = useNavigate();

  function deleteThread() {
    console.debug("[Thread] Delete thread", threadId);

    startTransition(async () => {
      await convexClient.mutation(api.functions.threads.deleteThread, { threadId });
      await navigate("/");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete "{title}" and every messages
            in it from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteThread} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
