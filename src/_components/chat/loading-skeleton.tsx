import { Skeleton } from "@/components/ui/skeleton";

type MessageRole = "user" | "assistant";

export function LoadingSkeleton() {
  return (
    <div data-slot="chat-loading-skeleton" className="absolute inset-0">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="mx-auto min-h-full max-w-[calc(56rem+32px)] space-y-4 px-4 py-20 pb-64">
          <MessageBubbleSkeleton from="user" />
          <MessageBubbleSkeleton from="assistant" />
        </div>
      </div>
    </div>
  );
}

function MessageBubbleSkeleton({ from }: { from: MessageRole }) {
  if (from === "assistant") {
    return (
      <div className="flex w-full justify-start">
        <div className="w-full max-w-3xl space-y-2 rounded-md border bg-background/70 p-4 backdrop-blur-md backdrop-saturate-150">
          <Skeleton className="h-4 w-[72%]" />
          <Skeleton className="h-4 w-[58%]" />
          <Skeleton className="h-4 w-[40%]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex w-full justify-end gap-2">
      <div className="w-full max-w-xl space-y-2 rounded-md border bg-background/70 p-4 backdrop-blur-md backdrop-saturate-150">
        <Skeleton className="h-4 w-[68%]" />
        <Skeleton className="h-4 w-[46%]" />
      </div>

      <Skeleton className="size-10 shrink-0 rounded-md" />
    </div>
  );
}
