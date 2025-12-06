import { api } from "@/convex/_generated/api";

import {
  DeleteIcon,
  EllipsisIcon,
  GitBranchIcon,
  GripVerticalIcon,
  Loader2Icon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useRef, useState, useTransition, type ComponentProps } from "react";
import { NavLink, useParams } from "react-router";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Dialog } from "@base-ui-components/react/dialog";
import { Menu } from "@base-ui-components/react/menu";

import { buttonVariants } from "../ui/button";
import { Input } from "../ui/input";

import { ThreadDeleteDialog } from "./thread-delete-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

type ThreadItemProps = {
  thread: Thread;
  disabled?: boolean;
  isOverlay?: boolean;
};

export function ThreadItem({ thread, disabled, isOverlay }: ThreadItemProps) {
  const { threadId } = useParams<{ threadId?: string }>();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: thread._id,
    disabled,
    data: { type: "thread", threadId: thread._id, belongsTo: thread.groupId ?? null },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isOverlay ? 0.5 : 1,
  };

  const isStreaming = thread.status === "streaming" || thread.status === "pending";

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-thread-id={thread._id}
      data-thread-active={threadId === toUUID(thread._id)}
      data-thread-index={thread.order}
      data-thread-status={thread.status}
      data-is-dragging={isDragging || isOverlay}
      data-slot="thread-item"
      className={cn(
        "group/thread flex items-center justify-between gap-2 overflow-hidden rounded-md px-2",
        "text-sidebar-foreground transition-colors hover:bg-primary/30",
        "data-[thread-active=true]:bg-primary/30 [&:has(button[data-popup-open])]:bg-primary/30",
        "data-[is-dragging=true]:bg-primary/30",
      )}
    >
      <NavLink
        title={thread.title}
        to={`/threads/${toUUID(thread._id)}`}
        className="flex w-full min-w-0 items-center gap-2 py-1.5"
      >
        {thread.branchedFrom && <GitBranchIcon className="size-4 shrink-0 rotate-180" />}
        <span className="truncate text-sm">{thread.title}</span>
      </NavLink>

      <div className="flex items-center gap-2">
        <ThreadActions thread={thread} isStreaming={isStreaming} />

        {isStreaming && (
          <div className="inline-block">
            <Loader2Icon className="size-4 animate-spin" />
            <span className="sr-only">Streaming...</span>
          </div>
        )}

        {!isStreaming && (
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "cursor-grab py-1.5 active:cursor-grabbing",
              (isDragging || disabled) && "cursor-grabbing",
            )}
          >
            <GripVerticalIcon className="size-4" />
          </div>
        )}
      </div>
    </div>
  );
}

type ThreadActionsProps = ComponentProps<typeof Menu.Trigger> & {
  thread: Thread;
  isStreaming: boolean;
};

function ThreadActions({ thread, isStreaming, className, ...props }: ThreadActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(thread.title);
  const [isSaving, startSaving] = useTransition();

  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  function regenerateTitle(): void {
    // Optimistically set the title to "Regenerating" on the server
    void convexClient.mutation(api.functions.threads.updateThreadTitle, {
      threadId: thread._id,
      title: "Regenerating",
    });

    // Trigger server-side regeneration using the existing updateTitle() pipeline
    void fetch("/api/threads/regenerate-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread._id }),
    });
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          ref={menuTriggerRef}
          data-slot="thread-actions"
          {...props}
          className={cn(
            "pointer-events-auto hidden items-center justify-center group-hover/thread:flex group-data-[thread-active=true]/thread:flex data-[popup-open]:flex",
            className,
          )}
        >
          <EllipsisIcon className="size-4 shrink-0" />
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner
            side="right"
            align="center"
            className="p-1"
            sideOffset={isStreaming ? 20 : 50}
          >
            <Menu.Popup className="flex w-max origin-[var(--transform-origin)] flex-col overflow-hidden rounded-md border bg-sidebar/60 backdrop-blur-md backdrop-saturate-150">
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

              {thread.groupId === null && (
                <Menu.Item
                  title={thread.pinned ? "Unpin Thread" : "Pin Thread"}
                  onClick={toggleThreadPin}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full cursor-pointer justify-start rounded-none",
                  )}
                >
                  {thread.pinned ? (
                    <PinOffIcon className="size-4" />
                  ) : (
                    <PinIcon className="size-4" />
                  )}
                  <span className="pointer-events-none">
                    {thread.pinned ? "Unpin Thread" : "Pin Thread"}
                  </span>
                </Menu.Item>
              )}

              <Menu.Item
                title="Regenerate Title"
                onClick={regenerateTitle}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full cursor-pointer justify-start rounded-none",
                )}
              >
                <RefreshCwIcon className="size-4" />
                <span className="pointer-events-none">Regenerate Title</span>
              </Menu.Item>

              <Menu.Item
                title="Edit Thread"
                onClick={() => {
                  setEditTitle(thread.title);
                  setEditOpen(true);

                  inputRef.current?.focus();
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
            className="fixed top-1/2 left-1/2 z-50 w-[min(96vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          >
            <div className="mb-2">
              <h2 className="text-lg font-semibold">Edit thread</h2>
              <p className="text-sm text-muted-foreground">Update the thread title.</p>
            </div>

            <form className="mt-3 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <Input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Thread title"
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
