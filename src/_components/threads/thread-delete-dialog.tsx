import { api } from "@/convex/_generated/api";

import { useNavigate } from "@tanstack/react-router";
import { useSessionMutation } from "convex-helpers/react/sessions";
import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";

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
} from "../ui/alert-dialog";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

import type { Thread } from "@/lib/types";

type ThreadDeleteDialogProps = {
  threadId: Thread["_id"];
  title: Thread["title"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
};

export function ThreadDeleteDialog({
  threadId,
  title,
  open,
  onOpenChange,
  redirectTo = "/",
}: ThreadDeleteDialogProps) {
  const navigate = useNavigate();
  const [pending, startTransition] = useTransition();

  const deleteThread = useSessionMutation(api.functions.threads.deleteThread);

  const [checked, setChecked] = useState(false);

  function deleteThreadHandler() {
    console.debug("[Thread] Delete thread", threadId);

    startTransition(async () => {
      await deleteThread({ threadId, deleteAttachments: checked });
      onOpenChange(false);

      if (redirectTo.length > 0) {
        await navigate({ to: redirectTo });
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2Icon className="size-5" />
          </AlertDialogMedia>
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
            onCheckedChange={(value) => setChecked(value === true)}
            className="size-5"
          />

          <Label htmlFor="delete-attachments" className="text-sm leading-none">
            Delete all attachments?
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteThreadHandler} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
