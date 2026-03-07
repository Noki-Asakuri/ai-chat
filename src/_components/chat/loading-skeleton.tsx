import { Skeleton } from "@/components/ui/skeleton";

type MessageRole = "user" | "assistant";

export function LoadingSkeleton() {
  return (
    <div data-slot="chat-loading-skeleton" className="absolute inset-0">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="mx-auto min-h-full max-w-5xl space-y-3 px-3 py-20 pb-64 md:px-6">
          <MessageRowSkeleton from="user" />
          <MessageRowSkeleton from="assistant" />
          <MessageRowSkeleton from="assistant" />
        </div>
      </div>

      <div
        className="pointer-events-none absolute right-0 bottom-2 left-0 px-4"
        data-slot="chat-textarea-skeleton"
      >
        <div className="mx-auto max-w-4xl space-y-2">
          <div className="space-y-2 rounded-2xl border bg-background/80 p-2.5 backdrop-blur-md backdrop-saturate-150">
            <Skeleton className="h-20 w-full rounded-xl" />

            <div className="flex items-end justify-between border-t pt-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>

              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageRowSkeleton({ from }: { from: MessageRole }) {
  return (
    <div className="rounded-2xl px-3 py-3">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />

        <div className="min-w-0 flex-1 space-y-2 md:pr-44">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            {from === "assistant" && <Skeleton className="h-4 w-14 rounded-full" />}
          </div>

          {from === "assistant" ? (
            <div className="w-full max-w-3xl space-y-3">
              <Skeleton className="h-4 w-[74%] rounded-full" />
              <Skeleton className="h-4 w-[58%] rounded-full" />
              <Skeleton className="h-4 w-[42%] rounded-full" />
            </div>
          ) : (
            <div className="w-full max-w-3xl rounded-2xl border border-border/50 bg-card/70 p-4 shadow-sm backdrop-blur-md backdrop-saturate-150">
              <div className="space-y-3">
                <Skeleton className="h-4 w-[70%] rounded-full" />
                <Skeleton className="h-4 w-[48%] rounded-full" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
