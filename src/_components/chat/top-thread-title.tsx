import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/skeleton";

import { convexSessionQuery } from "@/lib/convex/helpers";
import { fromUUID } from "@/lib/utils";

export function ThreadTitle({ isSkeleton }: { isSkeleton?: boolean }) {
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });

  const { data, isFetching } = useQuery({
    enabled: typeof params?.threadId === "string" && !isSkeleton,
    ...convexSessionQuery(api.functions.threads.getThreadTitle, {
      threadId: fromUUID<Id<"threads">>(params?.threadId),
    }),
  });

  if (isFetching || isSkeleton) return <Skeleton className="h-4 w-80" />;
  if (!params?.threadId || !data?.title) return null;

  return (
    <>
      <title>{data.title}</title>
      <p className="truncate text-sm text-muted-foreground">{data.title}</p>
    </>
  );
}
