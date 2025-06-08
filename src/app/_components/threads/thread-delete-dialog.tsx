import { api } from "@/convex/_generated/api";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import type { Thread } from "@/lib/types";

type ThreadDeleteDialogProps = {
  children: React.ReactNode;
  thread: Thread;
};

const convexClient = getConvexReactClient();

export function ThreadDeleteDialog({ children, thread }: ThreadDeleteDialogProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function deleteThread() {
    console.debug("[Thread] Delete thread", thread);

    startTransition(async () => {
      await convexClient.mutation(api.threads.deleteThread, { threadId: thread._id });
      router.push("/");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>

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
