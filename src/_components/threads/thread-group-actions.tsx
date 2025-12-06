import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { DeleteIcon, EllipsisIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { type ComponentPropsWithRef, useRef, useState, useTransition } from "react";

import { Dialog } from "@base-ui-components/react/dialog";
import { Menu } from "@base-ui-components/react/menu";

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
import { Input } from "../ui/input";

import { getConvexReactClient } from "@/lib/convex/client";
import { cn } from "@/lib/utils";

type ThreadGroupActionProps = ComponentPropsWithRef<"button"> & {
  group: Doc<"groups">;
};

const convexClient = getConvexReactClient();

export function ThreadGroupActions({ group, ...props }: ThreadGroupActionProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(group.title);

  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const menuTriggerRef = useRef<HTMLButtonElement>(null);
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
      await convexClient.mutation(api.functions.groups.deleteGroup, {
        groupId: group._id,
      });
      setDeleteOpen(false);
    });
  }

  if (!group) return null;

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          ref={menuTriggerRef}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className={cn("flex size-5 items-center justify-center")}
          {...props}
        >
          <EllipsisIcon className="size-4" />
          <span className="sr-only">Group actions</span>
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner side="right" align="center" className="p-1" sideOffset={42}>
            <Menu.Popup className="flex w-max origin-[var(--transform-origin)] flex-col overflow-hidden rounded-md border bg-sidebar/60 backdrop-blur-md backdrop-saturate-150">
              <Menu.Item
                title="Rename Group"
                onClick={() => {
                  setEditTitle(group.title);
                  setEditOpen(true);
                  inputRef.current?.focus();
                }}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full cursor-pointer justify-start rounded-none",
                )}
              >
                <PencilIcon className="size-4" />
                <span className="pointer-events-none">Rename Group</span>
              </Menu.Item>

              <Menu.Item
                title="Delete Group"
                onClick={() => setDeleteOpen(true)}
                className={cn(
                  buttonVariants({ variant: "destructive" }),
                  "w-full cursor-pointer justify-start rounded-t-none",
                )}
              >
                <DeleteIcon className="size-4" />
                <span className="pointer-events-none">Delete Group</span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

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
                  className={cn(buttonVariants({ variant: "ghost" }))}
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={cn(buttonVariants({ variant: "default" }))}
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
