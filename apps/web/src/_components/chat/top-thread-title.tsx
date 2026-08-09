import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { FolderIcon, PinIcon, PinOffIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadShareDialog } from "../threads/thread-share-dialog";

import { getConvexReactClient } from "@/lib/convex/client";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { fromUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadTitle({ isSkeleton }: { isSkeleton?: boolean }) {
  const [shareOpen, setShareOpen] = useState(false);

  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data, isFetching } = useQuery({
    enabled: typeof params?.threadId === "string" && !isSkeleton,
    ...convexSessionQuery(api.functions.threads.getThreadTitle, {
      threadId,
    }),
  });

  if (isFetching || isSkeleton) return <Skeleton className="h-4 w-80 max-w-full" />;
  if (!params?.threadId || !data?.title) return null;

  const threadData = data;

  function toggleThreadPin() {
    if (!threadId) return;

    void convexClient.mutation(api.functions.threads.pinThread, {
      threadId,
      pinned: !threadData.pinned,
    });
  }

  return (
    <>
      <title>{threadData.title + " - AI Chat"}</title>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 font-mono">
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-40 truncate text-muted-foreground">
            {threadData.groupTitle ?? "Ungrouped"}
          </span>
          <span aria-hidden="true" className="shrink-0 text-muted-foreground">
            /
          </span>
          <span className="truncate font-semibold">{threadData.title}</span>
        </div>

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
      </div>

      {threadId && (
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
