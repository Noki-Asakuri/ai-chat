import { api } from "@ai-chat/backend/convex/_generated/api";

import { Link, useParams } from "@tanstack/react-router";

import {
  CircleCheckIcon,
  DeleteIcon,
  FolderIcon,
  FolderInputIcon,
  GitBranchIcon,
  Loader2Icon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  Share2Icon,
} from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "@/components/ui/toast";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../ui/context-menu";
import { Icons } from "../ui/icons";
import { Button } from "../ui/button";

import { tryGetModelData } from "@/lib/chat/models";
import { getConvexReactClient } from "@/lib/convex/client";
import { threadDialogStoreActions } from "@/lib/store/thread-dialog-store";
import { useThreadStore } from "@/lib/store/thread-store";
import { regenerateThreadTitle } from "@/lib/trpc/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID, tryCatch } from "@/lib/utils";

const convexClient = getConvexReactClient();

type ThreadItemProps = {
  thread: Thread;
  now: number;
};

function formatRelativeTime(timestamp: number, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return "now";

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return `${elapsedDays}d`;

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) return `${elapsedMonths}mo`;

  return `${Math.floor(elapsedDays / 365)}y`;
}

export function ThreadItem({ thread, now }: ThreadItemProps) {
  const [isSettling, startSettling] = useTransition();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const isActive = params?.threadId === toUUID(thread._id);
  const isStreaming = thread.status === "streaming" || thread.status === "pending";
  const isSettled = thread.settled === true;
  const canSettle = thread.status === "complete" || thread.status === "error";
  const isRecentlyCreated = thread._creationTime > Date.now() - 1000 * 60 * 60 * 24 * 2;
  const hasUnreadCompletion =
    !isActive &&
    thread.status === "complete" &&
    (thread.lastViewedAt === undefined || thread.updatedAt > thread.lastViewedAt);
  const modelData = tryGetModelData(thread.latestModel);
  const modelName = modelData?.display.unique ?? modelData?.display.name ?? thread.latestModel;
  const threadUpdatedTime = (
    <time
      className={cn(isSettled && "shrink-0 text-xs text-muted-foreground")}
      dateTime={new Date(thread.updatedAt).toISOString()}
      title={new Date(thread.updatedAt).toLocaleString()}
    >
      {formatRelativeTime(thread.updatedAt, now)}
    </time>
  );

  function settleThread(): void {
    startSettling(async () => {
      const [, error] = await tryCatch(
        convexClient.mutation(api.functions.threads.settleThread, { threadId: thread._id }),
      );

      if (!error) return;

      console.error("[Thread] Settle thread error:", error);
      toast.error("Failed to settle thread", { description: error.message });
    });
  }

  const threadLink = (
    <Link
      preload={isRecentlyCreated || thread.pinned ? "viewport" : "intent"}
      preloadDelay={100}
      preloadIntentProximity={60}
      title={thread.title}
      to="/threads/$threadId"
      params={{ threadId: toUUID(thread._id) }}
      className={cn(
        "flex w-full min-w-0 px-2 py-2",
        isSettled ? "items-center gap-2" : "flex-col gap-1.5",
      )}
    >
      {isSettled ? (
        <>
          {modelData ? (
            <Icons.provider provider={modelData.provider} className="size-3.5 shrink-0" />
          ) : (
            <Icons.unknown className="size-3.5 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{thread.title}</span>
          {threadUpdatedTime}
        </>
      ) : (
        <>
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
                "flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground",
                canSettle && "group-focus-within/thread:opacity-0 group-hover/thread:opacity-0",
              )}
            >
              {thread.pinned && <PinIcon className="size-3.5" aria-hidden="true" />}

              {isStreaming ? (
                <span className="flex items-center gap-1 font-medium text-primary">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Working
                </span>
              ) : hasUnreadCompletion ? (
                <span className="flex items-center gap-1 font-medium text-success">
                  <CircleCheckIcon className="size-3.5" />
                  Done
                </span>
              ) : (
                threadUpdatedTime
              )}
            </span>
          </span>

          <span className="flex min-w-0 items-center gap-1.5">
            {thread.branchedFrom && <GitBranchIcon className="size-3.5 shrink-0 rotate-180" />}
            <span className="truncate text-sm font-medium">{thread.title}</span>
          </span>
        </>
      )}
    </Link>
  );

  return (
    <div
      data-thread-id={thread._id}
      data-thread-active={isActive}
      data-thread-index={thread.order}
      data-thread-status={thread.status}
      data-slot="thread-item"
      className={cn(
        "group/thread relative flex min-w-0 overflow-hidden rounded-lg",
        "text-sidebar-foreground transition-colors hover:bg-primary/30",
        "data-[thread-active=true]:bg-primary/30",
        isSettled && "opacity-50 hover:opacity-70",
      )}
    >
      <ThreadActions thread={thread} isStreaming={isStreaming}>
        {threadLink}
      </ThreadActions>

      {!isSettled && canSettle && (
        <Button
          variant="none"
          size="none"
          className="absolute top-2 right-2 h-4 gap-1 text-xs font-medium text-sidebar-foreground opacity-0 transition-none [&_svg]:size-3.5 group-focus-within/thread:opacity-100 group-hover/thread:opacity-100"
          aria-label={`Settle ${thread.title}`}
          disabled={isSettling}
          onClick={settleThread}
        >
          <CircleCheckIcon data-icon="inline-start" />
          {isSettling ? "Settling" : "Settle"}
        </Button>
      )}
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
  const groups = useThreadStore((state) => state.groupedThreads.groups);
  const destinationGroups = groups.filter((group) => group._id !== thread.groupId);
  const canMoveThread = thread.groupId !== null || destinationGroups.length > 0;

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

  async function moveThread(toGroupId: (typeof groups)[number]["_id"] | null) {
    const destinationTitle =
      toGroupId === null ? "Ungrouped" : destinationGroups.find((group) => group._id === toGroupId)?.title;
    if (!destinationTitle) return;

    const toIndex =
      toGroupId === null
        ? 0
        : (useThreadStore.getState().groupedThreads.groupedThreads[toGroupId]?.threads.length ?? 0);
    const [, error] = await tryCatch(
      convexClient.mutation(api.functions.groups.moveThreadToGroup, {
        threadId: thread._id,
        toGroupId,
        toIndex,
      }),
    );

    if (error) {
      console.error("[Thread] Move thread error:", error);
      toast.error("Failed to move thread", {
        description: error instanceof Error ? error.message : undefined,
      });
      return;
    }

    toast.success(`Thread moved to ${destinationTitle}`);
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

          <ContextMenuSub>
            <ContextMenuSubTrigger title="Move Thread" disabled={!canMoveThread}>
              <FolderInputIcon className="size-4" />
              <span className="pointer-events-none">Move to group</span>
            </ContextMenuSubTrigger>

            {canMoveThread && (
              <ContextMenuSubContent>
                <ContextMenuGroup>
                  {thread.groupId !== null && (
                    <ContextMenuItem
                      title="Ungrouped"
                      onClick={() => {
                        void moveThread(null);
                      }}
                    >
                      <FolderIcon className="size-4" />
                      <span className="pointer-events-none truncate">Ungrouped</span>
                    </ContextMenuItem>
                  )}

                  {destinationGroups.map((group) => (
                    <ContextMenuItem
                      key={group._id}
                      title={group.title}
                      onClick={() => {
                        void moveThread(group._id);
                      }}
                    >
                      <FolderIcon className="size-4" />
                      <span className="pointer-events-none truncate">{group.title}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuGroup>
              </ContextMenuSubContent>
            )}
          </ContextMenuSub>

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
