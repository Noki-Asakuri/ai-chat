import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { FolderIcon, PinIcon, PinOffIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadShareDialog } from "../threads/thread-share-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { threadStoreActions, useThreadStore } from "@/lib/store/thread-store";
import { fromUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadTitle({ isSkeleton }: { isSkeleton?: boolean }) {
  const [shareOpen, setShareOpen] = useState(false);
  const activeGroupId = useThreadStore((state) => state.activeGroupId);
  const activeGroup = useThreadStore((state) =>
    state.groupedThreads.groups.find((group) => group._id === state.activeGroupId),
  );

  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data, isFetching } = useQuery({
    enabled: typeof params?.threadId === "string" && !isSkeleton,
    ...convexSessionQuery(api.functions.threads.getThreadPageMeta, threadId ? { threadId } : "skip"),
  });

  const threadData = params?.threadId && data ? data : null;
  const groupId = threadData?.groupId ?? activeGroupId;
  const groupTitle = threadData?.groupTitle ?? activeGroup?.title ?? "Ungrouped";

  function toggleThreadPin() {
    if (!threadId || !threadData) return;

    void convexClient.mutation(api.functions.threads.pinThread, {
      threadId,
      pinned: !threadData.pinned,
    });
  }

  return (
    <>
      {threadData && <title>{threadData.title + " - AI Chat"}</title>}

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 font-mono">
          <Link
            to="/"
            title={`New chat in ${groupTitle}`}
            className="flex max-w-48 min-w-0 shrink-0 items-center gap-2 rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => {
              threadStoreActions.setActiveGroupId(groupId);
            }}
          >
            <FolderIcon className="size-4 shrink-0" />
            <span className="truncate">{groupTitle}</span>
          </Link>
          <span aria-hidden="true" className="shrink-0 text-muted-foreground">
            /
          </span>
          {isFetching || isSkeleton ? (
            <Skeleton className="h-4 w-48 max-w-full" />
          ) : (
            <span className="truncate font-semibold">{threadData?.title ?? "New Chat"}</span>
          )}
        </div>

        {threadData && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {threadData.isShared && (
              <Badge
                variant="secondary"
                className="hidden h-6 items-center gap-1 rounded-md border-border px-2 py-0 tracking-wide uppercase sm:flex"
              >
                <Share2Icon className="size-3" />
                Shared
              </Badge>
            )}

            <Button
              variant="ghost"
              size="icon-lg"
              className="[&_svg]:size-5!"
              title="Share Thread"
              aria-label="Share Thread"
              onClick={() => setShareOpen(true)}
            >
              <Share2Icon />
            </Button>

            <Button
              variant="ghost"
              size="icon-lg"
              className="[&_svg]:size-5!"
              title={threadData.pinned ? "Unpin Thread" : "Pin Thread"}
              aria-label={threadData.pinned ? "Unpin Thread" : "Pin Thread"}
              onClick={toggleThreadPin}
            >
              {threadData.pinned ? <PinOffIcon /> : <PinIcon />}
            </Button>
          </div>
        )}
      </div>

      {threadId && threadData && (
        <ThreadShareDialog
          threadId={threadId}
          threadTitle={threadData.title}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </>
  );
}
