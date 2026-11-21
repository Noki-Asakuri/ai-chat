import { api } from "@ai-chat/backend/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

import { toast } from "@/components/ui/toast";
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
  Undo2Icon,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "../ui/button";
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

import { tryGetModelData } from "@/lib/chat/models";
import { getConvexReactClient } from "@/lib/convex/client";
import { threadDialogStoreActions } from "@/lib/store/thread-dialog-store";
import { useThreadGroups } from "@/lib/threads/use-thread-groups";
import { useThreadPin } from "@/lib/threads/use-thread-pin";
import { regenerateThreadTitle } from "@/lib/trpc/client";
import type { Thread } from "@/lib/types";
import { cn, toUUID, tryCatch } from "@/lib/utils";

import { ROW_ICON, ROW_SCALE } from "./sidebar-scale";

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
  const { data: preferences } = useSuspenseQuery(convexQuery(api.functions.users.getCurrentUserPreferences));
  const [settleArmed, setSettleArmed] = useState(false);
  const [isUpdatingSettled, startUpdatingSettled] = useTransition();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const isActive = params?.threadId === toUUID(thread._id);
  const isStreaming = thread.status === "streaming" || thread.status === "pending";
  const isSettled = thread.settled === true;
  const canSettle = thread.status === "complete" || thread.status === "error";
  const isRecentlyCreated = thread._creationTime > now - 1000 * 60 * 60 * 24 * 2;
  const hasUnreadCompletion =
    !isActive &&
    thread.status === "complete" &&
    (thread.lastViewedAt === undefined || thread.updatedAt > thread.lastViewedAt);
  const modelData = tryGetModelData(thread.latestModel);
  const modelName = modelData?.display.unique ?? modelData?.display.name ?? thread.latestModel;
  const providerIcon = modelData ? (
    <Icons.provider provider={modelData.provider} aria-hidden="true" className={ROW_ICON} />
  ) : (
    <Icons.unknown aria-hidden="true" className={ROW_ICON} />
  );
  const threadUpdatedTime = (
    <time
      className="tabular-nums"
      dateTime={new Date(thread.updatedAt).toISOString()}
      title={new Date(thread.updatedAt).toLocaleString()}
    >
      {formatRelativeTime(thread.updatedAt, now)}
    </time>
  );
  const hasHoverAction = isSettled || canSettle;
  // Sized explicitly: the Button's own default icon size would otherwise win over the row's scale.
  const hoverActionIcon = isSettled ? (
    <Undo2Icon aria-hidden="true" className={ROW_ICON} />
  ) : (
    <CircleCheckIcon aria-hidden="true" className={ROW_ICON} />
  );
  const hoverActionLabel = isSettled
    ? "Unsettle"
    : isUpdatingSettled
      ? "Settling"
      : settleArmed
        ? "Confirm"
        : "Settle";

  function toggleThreadSettled(inline = false): void {
    if (!isSettled && preferences.confirmations?.settle) {
      if (inline && !settleArmed) {
        setSettleArmed(true);
        return;
      }
      if (!inline && !window.confirm(`Settle "${thread.title}"?`)) return;
    }
    setSettleArmed(false);
    startUpdatingSettled(async () => {
      const [, error] = await tryCatch(
        convexClient.mutation(
          isSettled ? api.functions.threads.unsettleThread : api.functions.threads.settleThread,
          { threadId: thread._id },
        ),
      );

      if (!error) return;

      const action = isSettled ? "unsettle" : "settle";
      console.error(`[Thread] ${action} thread error:`, error);
      toast.error(`Failed to ${action} thread`, { description: error.message });
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
        "flex w-full min-w-0 flex-col rounded-[inherit] px-(--row-px) py-(--row-py) outline-none",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 focus-visible:ring-inset",
      )}
    >
      <span className="flex h-(--row-line) min-w-0 items-center gap-(--row-gap) text-sm">
        {thread.branchedFrom && (
          <GitBranchIcon
            aria-label="Branched thread"
            className={cn(ROW_ICON, "rotate-180 text-muted-foreground")}
          />
        )}
        {isSettled && providerIcon}
        <span className="min-w-0 flex-1 truncate font-medium">{thread.title}</span>

        {/* While the row is hovered or focused, an invisible copy of the action takes the meta's place,
            so the title truncates to make room instead of running under the action. */}
        {hasHoverAction && (
          <span
            aria-hidden="true"
            className="invisible hidden shrink-0 items-center gap-(--row-gap) border border-transparent px-(--row-gap) text-xs font-medium group-focus-within/thread:flex group-hover/thread:flex"
          >
            {hoverActionIcon}
            {hoverActionLabel}
          </span>
        )}
        <span
          className={cn(
            "flex shrink-0 items-center gap-(--row-gap) text-xs text-muted-foreground",
            // Visually hidden rather than display:none, so screen readers still hear "Done" or the time.
            hasHoverAction && "group-focus-within/thread:sr-only group-hover/thread:sr-only",
          )}
        >
          {thread.pinned && <PinIcon aria-label="Pinned" className={ROW_ICON} />}
          {isStreaming ? (
            <span className="flex items-center gap-(--row-gap) font-medium text-primary">
              <Loader2Icon aria-hidden="true" className={cn(ROW_ICON, "animate-spin")} />
              Working
            </span>
          ) : hasUnreadCompletion ? (
            <span className="flex items-center gap-(--row-gap) font-medium text-success">
              <CircleCheckIcon aria-hidden="true" className={ROW_ICON} />
              Done
            </span>
          ) : (
            threadUpdatedTime
          )}
        </span>
      </span>

      {!isSettled && (
        <span className="mt-(--row-stack) flex min-w-0 items-center gap-(--row-gap) text-xs text-muted-foreground">
          {providerIcon}
          <span className="truncate">{modelName}</span>
        </span>
      )}
    </Link>
  );

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSettleArmed(false);
      }}
      data-thread-id={thread._id}
      data-thread-active={isActive}
      data-thread-status={thread.status}
      data-thread-settled={isSettled}
      data-slot="thread-item"
      className={cn(
        ROW_SCALE,
        "group/thread relative flex min-w-0 shrink-0 rounded-lg text-sidebar-foreground transition-colors duration-150",
        "hover:bg-sidebar-accent/70",
        "data-[thread-active=true]:bg-primary/15 data-[thread-active=true]:ring-1 data-[thread-active=true]:ring-primary/30 data-[thread-active=true]:ring-inset",
        "data-[thread-settled=true]:text-muted-foreground data-[thread-settled=true]:hover:text-sidebar-foreground",
      )}
    >
      <ThreadActions
        thread={thread}
        isStreaming={isStreaming}
        isUpdatingSettled={isUpdatingSettled}
        onToggleSettled={toggleThreadSettled}
      >
        {threadLink}
      </ThreadActions>

      {hasHoverAction && (
        // Mirrors the link's padding and first line, so the action sits exactly where the meta was.
        <div className="pointer-events-none absolute top-0 right-0 flex px-(--row-px) py-(--row-py)">
          <span className="flex h-(--row-line) items-center text-xs">
            <Button
              variant="none"
              size="none"
              className={cn(
                // Hidden with opacity, not visibility, so screen readers can still find it; pointer events stay
                // off until revealed, so a tap on a touch screen (no hover) can't hit it through the time.
                "pointer-events-none h-full gap-(--row-gap) rounded-md px-(--row-gap) text-xs font-medium text-sidebar-foreground opacity-0",
                "group-focus-within/thread:pointer-events-auto group-focus-within/thread:opacity-100 group-hover/thread:pointer-events-auto group-hover/thread:opacity-100",
                "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
              )}
              aria-label={
                isSettled
                  ? `Unsettle ${thread.title}`
                  : `${settleArmed ? "Confirm settling" : "Settle"} ${thread.title}`
              }
              disabled={isUpdatingSettled}
              onClick={() => toggleThreadSettled(true)}
            >
              {hoverActionIcon}
              {hoverActionLabel}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

type ThreadActionsProps = {
  thread: Thread;
  isStreaming: boolean;
  isUpdatingSettled: boolean;
  onToggleSettled: () => void;
  children: React.ReactNode;
};

function ThreadActions({
  thread,
  isStreaming,
  isUpdatingSettled,
  onToggleSettled,
  children,
}: ThreadActionsProps) {
  const pinThread = useThreadPin();
  const menuTriggerRef = useRef<HTMLDivElement>(null);
  const { data: threadGroups } = useThreadGroups();
  const groups = threadGroups?.groups ?? [];
  const destinationGroups = groups.filter((group) => group._id !== thread.groupId);
  const canMoveThread = thread.groupId !== null || destinationGroups.length > 0;
  const isSettled = thread.settled === true;
  const canSettle = thread.status === "complete" || thread.status === "error";

  function toggleThreadPin() {
    console.debug("[Thread] Pin thread", thread);
    void pinThread({
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

    const [, error] = await tryCatch(
      convexClient.mutation(api.functions.groups.moveThreadToGroup, {
        threadId: thread._id,
        toGroupId,
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

          <ContextMenuItem
            title={isSettled ? "Unsettle Thread" : "Settle Thread"}
            disabled={isUpdatingSettled || (!isSettled && !canSettle)}
            onClick={onToggleSettled}
          >
            {isSettled ? <Undo2Icon className="size-4" /> : <CircleCheckIcon className="size-4" />}
            <span className="pointer-events-none">{isSettled ? "Unsettle Thread" : "Settle Thread"}</span>
          </ContextMenuItem>

          {!isSettled && (
            <ContextMenuItem title="Regenerate Title" onClick={regenerateTitle}>
              <RefreshCwIcon className="size-4" />
              <span className="pointer-events-none">Regenerate Title</span>
            </ContextMenuItem>
          )}

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

          {!isSettled && (
            <ContextMenuItem
              title="Share Thread"
              onClick={() => {
                threadDialogStoreActions.openShareThread(thread);
              }}
            >
              <Share2Icon className="size-4" />
              <span className="pointer-events-none">Share Thread</span>
            </ContextMenuItem>
          )}

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
