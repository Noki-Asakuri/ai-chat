import { api } from "@ai-chat/backend/convex/_generated/api";
import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useSessionId } from "convex-helpers/react/sessions";
import { PinIcon, PinOffIcon, Share2Icon } from "lucide-react";
import { useState } from "react";

import { ThreadShareDialog } from "../threads/thread-share-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getConvexReactClient } from "@/lib/convex/client";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { fromUUID } from "@/lib/utils";

const convexClient = getConvexReactClient();

export function ThreadTitle({ isSkeleton }: { isSkeleton?: boolean }) {
  const [sessionId] = useSessionId();
  const [shareOpen, setShareOpen] = useState(false);

  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const threadId = fromUUID<Id<"threads">>(params?.threadId);

  const { data, isFetching } = useQuery({
    enabled: typeof params?.threadId === "string" && !isSkeleton,
    ...convexSessionQuery(api.functions.threads.getThreadTitle, {
      threadId,
    }),
  });

  if (isFetching || isSkeleton) return <Skeleton className="h-4 w-80" />;
  if (!params?.threadId || !data?.title) return null;

  const threadData = data;

  function toggleThreadPin() {
    if (!threadId || !sessionId) return;

    void convexClient.mutation(api.functions.threads.pinThread, {
      threadId,
      pinned: !threadData.pinned,
      sessionId,
    });
  }

  return (
    <>
      <title>{threadData.title}</title>

      <div className="hidden min-w-0 items-center gap-1 md:flex">
        <Button
          variant="ghost"
          title={threadData.pinned ? "Unpin Thread" : "Pin Thread"}
          className="size-7 cursor-pointer rounded-md border px-0"
          onClick={toggleThreadPin}
        >
          {threadData.pinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
          <span className="sr-only">{threadData.pinned ? "Unpin Thread" : "Pin Thread"}</span>
        </Button>

        <Button
          variant="ghost"
          title="Share Thread"
          className="size-7 cursor-pointer rounded-md border px-0"
          onClick={() => setShareOpen(true)}
        >
          <Share2Icon className="size-4" />
          <span className="sr-only">Share Thread</span>
        </Button>

        <p className="truncate text-sm text-muted-foreground">{threadData.title}</p>

        {threadData.isShared && (
          <Badge
            variant="secondary"
            className="h-6 items-center gap-1 rounded-md border-border px-2 py-0 tracking-wide uppercase"
          >
            <Share2Icon className="size-3" />
            Shared
          </Badge>
        )}
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
