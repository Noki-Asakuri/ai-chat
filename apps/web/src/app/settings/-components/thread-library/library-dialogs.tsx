import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

import { tryCatch } from "@/lib/utils";

type RenameThreadDialogProps = {
  threadId: Id<"threads">;
  title: string;
  onClose: () => void;
};

export function RenameThreadDialog({ threadId, title, onClose }: RenameThreadDialogProps) {
  const updateThreadTitle = useMutation(api.functions.threads.updateThreadTitle);
  const [value, setValue] = useState(title);
  const [pending, startTransition] = useTransition();
  const trimmed = value.trim();

  function save() {
    if (trimmed.length === 0) return;
    if (trimmed === title) {
      onClose();
      return;
    }

    startTransition(async () => {
      const [, error] = await tryCatch(updateThreadTitle({ threadId, title: trimmed }));
      if (error) {
        toast.error("Couldn't rename the thread", { description: error.message });
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename thread</DialogTitle>
          <DialogDescription>The new name shows in the sidebar and anywhere the thread is shared.</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            aria-label="Thread title"
            value={value}
            maxLength={200}
            onChange={(event) => setValue(event.target.value)}
            className="h-9 text-sm md:text-sm"
          />

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending || trimmed.length === 0}>
              {pending && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type BulkDeleteDialogProps = {
  open: boolean;
  threadIds: ReadonlyArray<Id<"threads">>;
  /** Threads left out because they are still generating and can't be deleted yet. */
  runningCount: number;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function BulkDeleteDialog({ open, threadIds, runningCount, onOpenChange, onDeleted }: BulkDeleteDialogProps) {
  const { data: preferences } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));
  const deleteThread = useMutation(api.functions.threads.deleteThread);
  const [deleteAttachments, setDeleteAttachments] = useState(false);
  const [pending, startTransition] = useTransition();
  const autoDeleted = useRef(false);
  const skipConfirmation = preferences.confirmations?.delete === false;
  const count = threadIds.length;
  const noun = count === 1 ? "thread" : "threads";

  function onDelete() {
    startTransition(async () => {
      const results = await Promise.all(
        threadIds.map((threadId) =>
          tryCatch(deleteThread({ threadId, deleteAttachments: !skipConfirmation && deleteAttachments })),
        ),
      );
      const failed = results.filter(([, error]) => error);

      if (failed.length > 0) {
        toast.error(`Couldn't delete ${failed.length} of ${count} ${noun}`, {
          description: failed[0]?.[1]?.message,
        });
      } else {
        toast.success(`Deleted ${count} ${noun}`);
      }

      onDeleted();
      onOpenChange(false);
    });
  }

  // With delete confirmations turned off, opening the dialog deletes straight away.
  const deleteWithoutConfirmation = useEffectEvent(onDelete);
  useEffect(() => {
    if (!open) autoDeleted.current = false;
    if (open && skipConfirmation && !autoDeleted.current) {
      autoDeleted.current = true;
      deleteWithoutConfirmation();
    }
  }, [open, skipConfirmation]);

  if (skipConfirmation) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Delete {count} {noun}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Their messages are deleted for good. This can't be undone.
            {runningCount > 0 &&
              ` ${runningCount} selected ${runningCount === 1 ? "thread is" : "threads are"} still generating and will be kept.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2">
          <Checkbox
            id="bulk-delete-attachments"
            checked={deleteAttachments}
            onCheckedChange={(checked) => setDeleteAttachments(checked)}
          />
          <Label htmlFor="bulk-delete-attachments" className="text-sm leading-none font-normal">
            Also delete their attachments
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete} disabled={pending || count === 0}>
            {pending && <Loader2Icon className="animate-spin" />}
            {pending ? "Deleting…" : `Delete ${count} ${noun}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
