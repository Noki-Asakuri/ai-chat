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
import { TrashIcon } from "lucide-react";
import { ButtonWithTip } from "../ui/button";

type ThreadDeleteDialogProps = {
  thread: Thread;
};

const convexClient = getConvexReactClient();

export function ThreadDeleteDialog({ thread }: ThreadDeleteDialogProps) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const navigate = useNavigate();

  function deleteThread() {
    console.debug("[Thread] Delete thread", thread);

    startTransition(async () => {
      await convexClient.mutation(api.threads.deleteThread, { threadId: thread._id });
      await navigate("/");
    });
  }

  function handleToggleOpen(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    setOpen(!open);
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <ButtonWithTip
        title="Delete Thread"
        variant="none"
        className="size-8"
        onClick={handleToggleOpen}
      >
        <TrashIcon size={10} />
        <span className="sr-only">Delete Thread</span>
      </ButtonWithTip>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete "{thread.title}" and every
            messages in it from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onMouseDown={deleteThread} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
