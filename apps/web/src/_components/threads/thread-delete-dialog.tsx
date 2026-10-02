import { api } from "@ai-chat/backend/convex/_generated/api";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
import { Loader2Icon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

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
import { toast } from "../ui/toast";

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
  const { data: preferences } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));
  const autoDeleted = useRef(false);
  const navigate = useNavigate();
  const [pending, startTransition] = useTransition();

  const deleteThread = useMutation(api.functions.threads.deleteThread);

  const [checked, setChecked] = useState(false);

  function deleteThreadHandler() {
    console.debug("[Thread] Delete thread", threadId);

    startTransition(async () => {
      try {
        await deleteThread({ threadId, deleteAttachments: preferences.confirmations?.delete !== false && checked });
      } catch (error) {
        toast.error("Failed to delete thread", {
          description: error instanceof Error ? error.message : undefined,
        });
        if (preferences.confirmations?.delete === false) onOpenChange(false);
        return;
      }
      onOpenChange(false);

      if (redirectTo.length > 0) {
        await navigate({ to: redirectTo });
      }
    });
  }

  const deleteWithoutConfirmation = useEffectEvent(deleteThreadHandler);
  useEffect(() => {
    if (!open) autoDeleted.current = false;
    if (open && preferences.confirmations?.delete === false && !autoDeleted.current) {
      autoDeleted.current = true;
      deleteWithoutConfirmation();
    }
  }, [open, preferences.confirmations?.delete]);

  if (preferences.confirmations?.delete === false) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-500/15 text-amber-400">
            <TriangleAlertIcon className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete "{title}" and every messages in it from
            our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2">
          <Checkbox
            id="delete-attachments"
            checked={checked}
            onCheckedChange={(value) => setChecked(value)}
            className="size-5"
          />

          <Label htmlFor="delete-attachments" className="text-sm leading-none">
            Delete all attachments?
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteThreadHandler} disabled={pending}>
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2Icon className="size-4" />
                Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
