import { CopyIcon, SplitIcon, TrashIcon, RefreshCcwIcon, PencilIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

type MessageRole = "user" | "assistant";

export function LoadingSkeleton() {
  return (
    <div data-slot="chat-loading-skeleton" className="absolute inset-0">
      <div className="mx-auto min-h-full max-w-[calc(56rem+32px)] space-y-6 px-3 pt-12 pb-64 sm:px-4">
        <MessageBubbleSkeleton from="user" />
        <MessageBubbleSkeleton from="assistant" />

        <MessageBubbleSkeleton from="user" showActions />
        <MessageBubbleSkeleton from="assistant" showActions />
      </div>
    </div>
  );
}

function MessageBubbleSkeleton({ from, showActions = false }: { from: MessageRole; showActions?: boolean }) {
  switch (from) {
    case "user":
      return (
        <div className="flex flex-col gap-1">
          <div className="flex w-full items-start justify-end gap-2">
            <div className="w-[80%] max-w-md space-y-2 rounded-2xl rounded-br-md bg-secondary px-4 py-3">
              <Skeleton className="h-4 w-[68%]" />
              <Skeleton className="h-4 w-[46%]" />
            </div>
            <Skeleton className="mt-0.5 size-7 shrink-0 rounded-md sm:size-9" />
          </div>

          <MessageActionsSkeleton show={showActions} from="user" />
        </div>
      );

    case "assistant":
      return (
        <div className="flex flex-col gap-1">
          <div className="flex w-full items-start gap-3 px-0.5 sm:px-0">
            <Skeleton className="hidden size-9 shrink-0 rounded-md sm:block" />
            <div className="w-full space-y-2.5">
              <div className="flex min-h-7 items-center gap-2 sm:min-h-9">
                <Skeleton className="size-7 shrink-0 rounded-md sm:hidden" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <Skeleton className="h-4 w-[72%]" />
              <Skeleton className="h-4 w-[58%]" />
              <Skeleton className="h-4 w-[40%]" />
            </div>
          </div>

          <MessageActionsSkeleton show={showActions} from="assistant" />
        </div>
      );

    default:
      return null;
  }
}

function MessageActionsSkeleton({ show, from }: { show: boolean; from: MessageRole }) {
  const sharedClassName = cn(
    "flex w-max items-center gap-0.5 text-muted-foreground",
    "opacity-0 transition-opacity",
    { "opacity-100": show },
  );

  switch (from) {
    case "user":
      return (
        <div className={cn(sharedClassName, "ml-auto pr-9 sm:pr-11")}>
          <MessageButtonAction icon={<CopyIcon />} />
          <MessageButtonAction icon={<RefreshCcwIcon />} />
          <MessageButtonAction icon={<TrashIcon />} />
          <MessageButtonAction icon={<PencilIcon />} />
        </div>
      );

    case "assistant":
      return (
        <div className={cn(sharedClassName, "sm:pl-12")}>
          <MessageButtonAction icon={<CopyIcon />} />
          <MessageButtonAction icon={<SplitIcon className="rotate-180" />} />
          <MessageButtonAction icon={<RefreshCcwIcon />} />
          <MessageButtonAction icon={<TrashIcon />} />
        </div>
      );

    default:
      return null;
  }
}

function MessageButtonAction({ icon }: { icon: React.ReactNode }) {
  return (
    <Button variant="ghost" className="size-8" disabled>
      {icon}
    </Button>
  );
}
