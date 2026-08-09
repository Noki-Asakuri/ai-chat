import { api } from "@ai-chat/backend/convex/_generated/api";

import { Link, useParams } from "@tanstack/react-router";

import {
  CircleCheckIcon,
  DeleteIcon,
  GitBranchIcon,
  Loader2Icon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  Share2Icon,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "@/components/ui/toast";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../ui/context-menu";
import { Icons } from "../ui/icons";

import { tryGetModelData } from "@/lib/chat/models";
import { getConvexReactClient } from "@/lib/convex/client";
import { threadDialogStoreActions } from "@/lib/store/thread-dialog-store";
import { regenerateThreadTitle } from "@/lib/trpc/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID, tryCatch } from "@/lib/utils";

const convexClient = getConvexReactClient();

type ThreadItemProps = {
  thread: Thread;
  showMetadata?: boolean;
};

export function ThreadItem({ thread, showMetadata = false }: ThreadItemProps) {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const isStreaming = thread.status === "streaming" || thread.status === "pending";
  const isRecentlyCreated = thread._creationTime > Date.now() - 1000 * 60 * 60 * 24 * 2;
  const modelData = showMetadata ? tryGetModelData(thread.latestModel) : null;
  const modelName = modelData?.display.unique ?? modelData?.display.name ?? thread.latestModel;

  const threadLink = (
    <Link
      preload={isRecentlyCreated || thread.pinned ? "viewport" : "intent"}
      preloadDelay={100}
      preloadIntentProximity={60}
      title={thread.title}
      to="/threads/$threadId"
      params={{ threadId: toUUID(thread._id) }}
      className={cn(
        "flex w-full min-w-0 px-2",
        showMetadata ? "flex-col gap-1.5 py-2" : "items-center gap-1.5 py-1.5",
      )}
    >
      {showMetadata && (
        <span className="flex w-full min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {modelData ? (
              <Icons.provider provider={modelData.provider} className="size-3.5 shrink-0" />
            ) : (
              <Icons.unknown className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{modelName}</span>
          </span>

          <span
            className={cn(
              "flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-sm font-medium",
              isStreaming ? "text-primary" : "text-success",
            )}
          >
            {isStreaming ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                Working
              </>
            ) : (
              <>
                <CircleCheckIcon className="size-3.5" />
                Done
              </>
            )}
          </span>
        </span>
      )}

      {thread.branchedFrom && <GitBranchIcon className="size-3.5 shrink-0 rotate-180" />}
      <span className="truncate text-sm font-medium">{thread.title}</span>
    </Link>
  );

  return (
    <div
      data-thread-id={thread._id}
      data-thread-active={params?.threadId === toUUID(thread._id)}
      data-thread-index={thread.order}
      data-thread-status={thread.status}
      data-slot="thread-item"
      className={cn(
        "flex min-w-0 overflow-hidden rounded-lg",
        "text-sidebar-foreground transition-colors hover:bg-primary/30",
        "data-[thread-active=true]:bg-primary/30",
      )}
    >
      <ThreadActions thread={thread} isStreaming={isStreaming}>
        {threadLink}
      </ThreadActions>
    </div>
  );
}

type ThreadActionsProps = {
  thread: Thread;
  isStreaming: boolean;
  children: React.ReactNode;
};

function ThreadActions({ thread, isStreaming, children }: ThreadActionsProps) {
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
              threadDialogStoreActions.openEditThread(thread);
            }}
          >
            <PencilIcon className="size-4" />
            <span className="pointer-events-none">Edit Thread</span>
          </ContextMenuItem>

          <ContextMenuItem
            title="Share Thread"
            onClick={() => {
              threadDialogStoreActions.openShareThread(thread);
            }}
          >
            <Share2Icon className="size-4" />
            <span className="pointer-events-none">Share Thread</span>
          </ContextMenuItem>

          <ContextMenuItem
            title="Delete Thread"
            onClick={() => threadDialogStoreActions.openDeleteThread(thread)}
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
