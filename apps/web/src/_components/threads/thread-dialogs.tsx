import { api } from "@ai-chat/backend/convex/_generated/api";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { buttonVariants } from "../ui/button";
import { Input } from "../ui/input";

import { ThreadDeleteDialog } from "./thread-delete-dialog";
import { ThreadShareDialog } from "./thread-share-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import { threadDialogStoreActions, useThreadDialogStore } from "@/lib/store/thread-dialog-store";
import { cn } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadDialogs() {
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [isSavingTitle, startSavingTitle] = useTransition();
  const activeDialog = useThreadDialogStore((state) => state.activeDialog);
  const dialogThread = useThreadDialogStore((state) => state.thread);

  const isEditDialogOpen = activeDialog === "edit" && dialogThread !== null;
  const isDeleteDialogOpen = activeDialog === "delete" && dialogThread !== null;
  const isShareDialogOpen = activeDialog === "share" && dialogThread !== null;
  const editTitle = editedTitle ?? dialogThread?.title ?? "";

  function saveThreadTitle(): void {
    if (!dialogThread || activeDialog !== "edit") return;

    const title = editTitle.trim();
    if (!title || title === dialogThread.title) {
      setEditedTitle(null);
      threadDialogStoreActions.closeThreadDialog();
      return;
    }

    console.debug("[Thread] Update title", { threadId: dialogThread._id, title });
    startSavingTitle(async () => {
      await convexClient.mutation(api.functions.threads.updateThreadTitle, {
        threadId: dialogThread._id,
        title,
      });

      setEditedTitle(null);
      threadDialogStoreActions.closeThreadDialog();
    });
  }

  return (
    <>
      {isEditDialogOpen && (
        <Dialog.Root
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setEditedTitle(null);
              threadDialogStoreActions.closeThreadDialog();
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:opacity-70" />
            <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background p-6 shadow-lg transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <div className="mb-2">
                <h2 className="text-lg font-semibold">Edit thread</h2>
                <p className="text-sm text-muted-foreground">Update the thread title.</p>
              </div>

              <form
                className="mt-3 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveThreadTitle();
                }}
              >
                <Input
                  value={editTitle}
                  onChange={(event) => setEditedTitle(event.target.value)}
                  placeholder="Thread title"
                />

                <div className="flex justify-end gap-2">
                  <Dialog.Close className={cn(buttonVariants({ variant: "ghost" }))}>Cancel</Dialog.Close>

                  <button
                    type="submit"
                    className={cn(buttonVariants({ variant: "default" }))}
                    disabled={isSavingTitle || editTitle.trim().length === 0}
                  >
                    {isSavingTitle ? <Loader2Icon className="size-4 animate-spin" /> : null}
                    Save
                  </button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {isDeleteDialogOpen && dialogThread && (
        <ThreadDeleteDialog
          threadId={dialogThread._id}
          title={dialogThread.title}
          open={true}
          onOpenChange={(open) => {
            if (!open) threadDialogStoreActions.closeThreadDialog();
          }}
        />
      )}

      {isShareDialogOpen && dialogThread && (
        <ThreadShareDialog
          key={dialogThread._id}
          threadId={dialogThread._id}
          threadTitle={dialogThread.title}
          open={true}
          onOpenChange={(open) => {
            if (!open) threadDialogStoreActions.closeThreadDialog();
          }}
        />
      )}
    </>
  );
}
