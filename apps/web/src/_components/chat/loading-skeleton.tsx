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
          <div className="flex w-full justify-end">
            <div className="w-[85%] max-w-md space-y-2 rounded-2xl rounded-br-md bg-secondary px-4 py-3 sm:w-[80%]">
              <Skeleton className="h-4 w-[68%]" />
              <Skeleton className="h-4 w-[46%]" />
            </div>
          </div>

          <MessageActionsSkeleton show={showActions} from="user" />
        </div>
      );

    case "assistant":
      return (
        <div className="flex flex-col gap-1">
          <div className="flex w-full justify-start px-0.5 sm:px-1">
            <div className="w-full space-y-2.5">
              <Skeleton className="h-3 w-24" />
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
        <div className={cn(sharedClassName, "ml-auto")}>
          <MessageButtonAction icon={<CopyIcon />} />
          <MessageButtonAction icon={<RefreshCcwIcon />} />
          <MessageButtonAction icon={<TrashIcon />} />
          <MessageButtonAction icon={<PencilIcon />} />
        </div>
      );

    case "assistant":
      return (
        <div className={cn(sharedClassName)}>
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
