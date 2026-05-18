import { api } from "@ai-chat/backend/convex/_generated/api";

import { Link, useParams } from "@tanstack/react-router";

import {
  DeleteIcon,
  GitBranchIcon,
  GripVerticalIcon,
  Loader2Icon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  Share2Icon,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../ui/context-menu";

import { getConvexReactClient } from "@/lib/convex/client";
import { regenerateThreadTitle } from "@/lib/trpc/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID, tryCatch } from "@/lib/utils";

const convexClient = getConvexReactClient();

type ThreadItemProps = {
  thread: Thread;
  disabled?: boolean;
  isOverlay?: boolean;
  onShareThread?: (thread: Thread) => void;
  onEditThread?: (thread: Thread) => void;
  onDeleteThread?: (thread: Thread) => void;
};

export function ThreadItem({
  thread,
  disabled,
  isOverlay,
  onShareThread,
  onEditThread,
  onDeleteThread,
}: ThreadItemProps) {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
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
  const isRecentlyCreated = thread._creationTime > Date.now() - 1000 * 60 * 60 * 24 * 2;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-thread-id={thread._id}
      data-thread-active={params?.threadId === toUUID(thread._id)}
      data-thread-index={thread.order}
      data-thread-status={thread.status}
      data-is-dragging={isDragging || isOverlay}
      data-slot="thread-item"
      className={cn(
        "group/thread flex items-center justify-between gap-2 overflow-hidden rounded-md px-2",
        "text-sidebar-foreground transition-colors hover:bg-primary/30",
        "data-[thread-active=true]:bg-primary/30",
        "data-[is-dragging=true]:bg-primary/30",
      )}
    >
      {!(isDragging || disabled) ? (
        <ThreadActions
          thread={thread}
          isStreaming={isStreaming}
          onShareThread={onShareThread}
          onEditThread={onEditThread}
          onDeleteThread={onDeleteThread}
        >
          <Link
            preload={isRecentlyCreated || thread.pinned ? "viewport" : "intent"}
            preloadDelay={100}
            preloadIntentProximity={60}
            title={thread.title}
            to="/threads/$threadId"
            params={{ threadId: toUUID(thread._id) }}
            className="flex w-full min-w-0 items-center gap-2 py-1.5"
          >
            {thread.branchedFrom && <GitBranchIcon className="size-4 shrink-0 rotate-180" />}
            <span className="truncate text-sm">{thread.title}</span>
          </Link>
        </ThreadActions>
      ) : (
        <Link
          preload={isRecentlyCreated || thread.pinned ? "viewport" : "intent"}
          preloadDelay={100}
          preloadIntentProximity={60}
          title={thread.title}
          to="/threads/$threadId"
          params={{ threadId: toUUID(thread._id) }}
          className="flex w-full min-w-0 items-center gap-2 py-1.5"
        >
          {thread.branchedFrom && <GitBranchIcon className="size-4 shrink-0 rotate-180" />}
          <span className="truncate text-sm">{thread.title}</span>
        </Link>
      )}

      <div className="flex items-center gap-2">
        {isStreaming && (
          <div className="inline-block">
            <Loader2Icon className="size-4 animate-spin" />
            <span className="sr-only">Streaming...</span>
          </div>
        )}

        {!isStreaming && (
          <div
            data-slot="thread-dnd-handle"
            {...attributes}
            {...listeners}
            className={cn(
              "cursor-grab py-1.5 active:cursor-grabbing",
              "hidden group-hover/thread:flex",
              (isDragging || disabled) && "flex cursor-grabbing",
            )}
          >
            <GripVerticalIcon className="size-4" />
          </div>
        )}
      </div>
    </div>
  );
}

type ThreadActionsProps = {
  thread: Thread;
  isStreaming: boolean;
  onShareThread?: (thread: Thread) => void;
  onEditThread?: (thread: Thread) => void;
  onDeleteThread?: (thread: Thread) => void;
  children: React.ReactNode;
};

function ThreadActions({
  thread,
  isStreaming,
  onShareThread,
  onEditThread,
  onDeleteThread,
  children,
}: ThreadActionsProps) {
  const menuTriggerRef = useRef<HTMLDivElement>(null);

  function toggleThreadPin() {
    console.debug("[Thread] Pin thread", thread);
    void convexClient.mutation(api.functions.threads.pinThread, {
      threadId: thread._id,
      pinned: !thread.pinned,
    });
  }

  async function regenerateTitle() {
    const [, error] = await tryCatch(regenerateThreadTitle({ threadId: thread._id }));
    if (!error) return;

    console.error("[Thread] Regenerate title error:", error);
    toast.error(error.message);
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger ref={menuTriggerRef} className="min-w-0 flex-1">
          {children}
        </ContextMenuTrigger>

        <ContextMenuContent side="right" align="center" sideOffset={isStreaming ? 8 : 12}>
          {thread.branchedFrom && (
            <ContextMenuItem
              title="Go to parent thread"
              render={
                <Link preload={false} to="/threads/$threadId" params={{ threadId: thread.branchedFrom }} />
              }
            >
              <GitBranchIcon className="size-4 rotate-180" />
              <span className="pointer-events-none">Go to parent thread</span>
            </ContextMenuItem>
          )}

          {thread.groupId === null && (
            <ContextMenuItem title={thread.pinned ? "Unpin Thread" : "Pin Thread"} onClick={toggleThreadPin}>
              {thread.pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}

              <span className="pointer-events-none">{thread.pinned ? "Unpin Thread" : "Pin Thread"}</span>
            </ContextMenuItem>
          )}

          <ContextMenuItem title="Regenerate Title" onClick={regenerateTitle}>
            <RefreshCwIcon className="size-4" />
            <span className="pointer-events-none">Regenerate Title</span>
          </ContextMenuItem>

          <ContextMenuItem
            title="Edit Thread"
            onClick={() => {
              onEditThread?.(thread);
            }}
          >
            <PencilIcon className="size-4" />
            <span className="pointer-events-none">Edit Thread</span>
          </ContextMenuItem>

          <ContextMenuItem
            title="Share Thread"
            onClick={() => {
              onShareThread?.(thread);
            }}
          >
            <Share2Icon className="size-4" />
            <span className="pointer-events-none">Share Thread</span>
          </ContextMenuItem>

          <ContextMenuItem
            title="Delete Thread"
            onClick={() => onDeleteThread?.(thread)}
            disabled={isStreaming}
            variant="destructive"
          >
            <DeleteIcon className="size-4" />
            <span className="pointer-events-none">Delete Thread</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
