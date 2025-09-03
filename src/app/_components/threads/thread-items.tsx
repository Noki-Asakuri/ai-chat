import { api } from "@/convex/_generated/api";

import {
  DeleteIcon,
  EllipsisIcon,
  GitBranchIcon,
  Loader2Icon,
  PinIcon,
  PinOffIcon,
  PencilIcon,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { NavLink, useParams } from "react-router";

import { Menu } from "@base-ui-components/react/menu";
import { Dialog } from "@base-ui-components/react/dialog";

import { Input } from "../ui/input";
import { buttonVariants } from "../ui/button";
import { ThreadDeleteDialog } from "./thread-delete-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadItem({ thread }: { thread: Thread }) {
  const { threadId } = useParams<{ threadId?: string }>();

  return (
    <NavLink
      to={`/threads/${toUUID(thread._id)}`}
      title={thread.title}
      data-active={threadId === toUUID(thread._id)}
      data-status={thread.status}
      className={cn(
        "group/thread relative flex w-full items-center gap-1 overflow-hidden rounded-md px-2 py-1.5",
        "text-sidebar-foreground hover:bg-primary/30 transition-colors",
        "[&:has(button[data-popup-open])]:bg-primary/30",
        "data-[active=true]:bg-primary/30",
      )}
    >
      <div className="flex w-full items-center gap-2 group-hover/thread:w-[calc(100%-20px)] group-data-[active=true]/thread:w-[calc(100%-20px)]">
        <div className="flex w-full items-center justify-between gap-2">
          {thread.branchedFrom && <GitBranchIcon className="size-4 shrink-0 rotate-180" />}
          <span className="truncate text-sm">{thread.title}</span>

          {thread.status && thread.status !== "complete" && (
            <div className="inline-block">
              <Loader2Icon className="size-4 animate-spin" />
              <span className="sr-only">Streaming...</span>
            </div>
          )}
        </div>
      </div>

      <ThreadActions thread={thread} />
    </NavLink>
  );
}

function ThreadActions({ thread }: { thread: Thread }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(thread.title);
  const [isSaving, startSaving] = useTransition();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  function toggleThreadPin() {
    console.debug("[Thread] Pin thread", thread);
    void convexClient.mutation(api.functions.threads.pinThread, {
      threadId: thread._id,
      pinned: !thread.pinned,
    });
  }

  function saveThreadTitle(): void {
    const title = editTitle.trim();

    if (!title || title === thread.title) {
      setEditOpen(false);
      return;
    }

    console.debug("[Thread] Update title", { threadId: thread._id, title });
    startSaving(async () => {
      await convexClient.mutation(api.functions.threads.updateThreadTitle, {
        threadId: thread._id,
        title,
      });

      setEditOpen(false);
    });
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          ref={menuTriggerRef}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          className="pointer-events-auto hidden size-5 items-center justify-center group-hover/thread:flex group-data-[active=true]/thread:flex group-data-[status=streaming]/thread:hidden data-[popup-open]:flex"
        >
          <EllipsisIcon className="size-4" />
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner side="right" align="center" className="p-1" sideOffset={12}>
            <Menu.Popup className="bg-sidebar flex w-max origin-[var(--transform-origin)] flex-col overflow-hidden rounded-md border">
              {thread.branchedFrom && (
                <Menu.Item
                  title="Go to parent thread"
                  render={<NavLink to={`/threads/${toUUID(thread.branchedFrom)}`} />}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full justify-start rounded-b-none",
                  )}
                >
                  <GitBranchIcon className="size-4 rotate-180" />
                  <span className="pointer-events-none">Go to parent thread</span>
                </Menu.Item>
              )}

              <Menu.Item
                title={thread.pinned ? "Unpin Thread" : "Pin Thread"}
                onClick={toggleThreadPin}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full cursor-pointer justify-start rounded-none",
                )}
              >
                {thread.pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
                <span className="pointer-events-none">
                  {thread.pinned ? "Unpin Thread" : "Pin Thread"}
                </span>
              </Menu.Item>

              <Menu.Item
                title="Edit Thread"
                onClick={() => {
                  setEditTitle(thread.title);
                  setEditOpen(true);
                }}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full cursor-pointer justify-start rounded-none",
                )}
              >
                <PencilIcon className="size-4" />
                <span className="pointer-events-none">Edit Thread</span>
              </Menu.Item>

              <Menu.Item
                title="Delete Thread"
                onClick={() => setDeleteOpen(true)}
                className={cn(
                  buttonVariants({ variant: "destructive" }),
                  "w-full cursor-pointer justify-start rounded-t-none",
                )}
              >
                <DeleteIcon className="size-4" />
                <span className="pointer-events-none">Delete Thread</span>
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
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6 shadow-lg transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <div className="mb-2">
              <h2 className="text-lg font-semibold">Edit thread</h2>
              <p className="text-muted-foreground text-sm">Update the thread title.</p>
            </div>

            <form className="mt-3 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Thread title"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <Dialog.Close className={cn(buttonVariants({ variant: "ghost" }))}>
                  Cancel
                </Dialog.Close>

                <button
                  type="submit"
                  className={cn(buttonVariants({ variant: "default" }))}
                  disabled={isSaving || editTitle.trim().length === 0}
                  onClick={saveThreadTitle}
                >
                  {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  Save
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <ThreadDeleteDialog
        threadId={thread._id}
        title={thread.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
