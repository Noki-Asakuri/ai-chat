import { api } from "@/convex/_generated/api";

import { useState, useTransition } from "react";
import { useNavigate } from "react-router";

import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
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
  const navigate = useNavigate();
  const [pending, startTransition] = useTransition();

  const [checked, setChecked] = useState(false);

  function deleteThread() {
    console.debug("[Thread] Delete thread", threadId);

    startTransition(async () => {
      await convexClient.mutation(api.functions.threads.deleteThread, {
        threadId,
        deleteAttachments: checked,
      });
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

        <div className="flex items-center gap-2">
          <Checkbox
            id="delete-attachments"
            checked={checked}
            onCheckedChange={() => setChecked(!checked)}
            className="size-5"
          />

          <Label
            htmlFor="delete-attachments"
            className="text-sm leading-none"
            onClick={() => setChecked(!checked)}
          >
            Delete all attachments?
          </Label>
        </div>

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
