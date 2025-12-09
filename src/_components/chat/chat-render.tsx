import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/skeleton";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { fromUUID } from "@/lib/utils";

export function Chat() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });

  const { data, isLoading } = useQuery({
    enabled: Boolean(params?.threadId),
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, {
      threadId: fromUUID<Id<"threads">>(params?.threadId),
    }),
  });

  return null;
}

export function ThreadTitle({ isSkeleton }: { isSkeleton?: boolean }) {
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });

  const { data, isPending } = useQuery({
    enabled: Boolean(params?.threadId) || isSkeleton,
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, {
      threadId: fromUUID<Id<"threads">>(params?.threadId),
    }),
  });

  if (isPending || isSkeleton) return <Skeleton className="h-4 w-80" />;
  if (!params?.threadId || !data?.thread) {
    return <p className="text-sm text-muted-foreground">New Thread</p>;
  }

  return (
    <>
      <title>{data.thread.title}</title>
      <p className="truncate text-sm text-muted-foreground">{data.thread.title}</p>
    </>
  );
}
