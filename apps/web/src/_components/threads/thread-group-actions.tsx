import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Doc } from "@ai-chat/backend/convex/_generated/dataModel";

import { DeleteIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { type ReactNode, useRef, useState, useTransition } from "react";

import { Dialog } from "@base-ui/react/dialog";

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
import { buttonVariants } from "../ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../ui/context-menu";
import { Input } from "../ui/input";

import { getConvexReactClient } from "@/lib/convex/client";

type ThreadGroupActionProps = {
  group: Doc<"groups">;
  children: ReactNode;
};

const convexClient = getConvexReactClient();

export function ThreadGroupActions({ group, children }: ThreadGroupActionProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(group.title);

  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const menuTriggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function saveGroupTitle(): void {
    const title = editTitle.trim();
    if (!title || title === group.title) {
      setEditOpen(false);
      return;
    }

    startSaving(async () => {
      await convexClient.mutation(api.functions.groups.updateGroupTitle, {
        groupId: group._id,
        title,
      });
      setEditOpen(false);
    });
  }

  function deleteGroup(): void {
    startDeleting(async () => {
      await convexClient.mutation(api.functions.groups.deleteGroup, { groupId: group._id });
      setDeleteOpen(false);
    });
  }

  if (!group) return null;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger ref={menuTriggerRef} className="min-w-0 flex-1">
          {children}
        </ContextMenuTrigger>

        <ContextMenuContent side="right" align="center" sideOffset={8}>
          <ContextMenuItem
            title="Rename Group"
            onClick={() => {
              setEditTitle(group.title);
              setEditOpen(true);
              inputRef.current?.focus();
            }}
          >
            <PencilIcon className="size-4" />
            <span className="pointer-events-none">Rename Group</span>
          </ContextMenuItem>

          <ContextMenuItem title="Delete Group" onClick={() => setDeleteOpen(true)} variant="destructive">
            <DeleteIcon className="size-4" />
            <span className="pointer-events-none">Delete Group</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black opacity-20 transition-[opacity] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:opacity-70" />
          <Dialog.Popup
            finalFocus={menuTriggerRef}
            className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <div className="mb-2">
              <h2 className="text-lg font-semibold">Rename group</h2>
              <p className="text-sm text-muted-foreground">Update the group title.</p>
            </div>

            <form className="mt-3 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <Input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Group title"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={buttonVariants({ variant: "ghost" })}
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={buttonVariants({ variant: "default" })}
                  disabled={isSaving || editTitle.trim().length === 0}
                  onClick={saveGroupTitle}
                >
                  {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{group.title}”?</AlertDialogTitle>
          </AlertDialogHeader>

          <AlertDialogDescription>
            This action cannot be undone. Threads in this group will be moved to “Ungrouped”.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteGroup} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
