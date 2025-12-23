import { Icons } from "../ui/icons";
import { Shimmer } from "../ui/ai-elements/shimmer";

import { getModelData, type Provider } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessagePendingProps = {
  metadata: ChatMessage["metadata"];
};

export function MessagePending({ metadata }: MessagePendingProps) {
  const requestModelId = metadata?.model.request;
  const modelData = requestModelId ? getModelData(requestModelId) : undefined;

  const effort = metadata?.modelParams?.effort;
  const showEffort =
    modelData?.capabilities.reasoning === true && effort !== undefined && effort !== "medium";

  const modelName = modelData?.display.name ?? "Model";
  const provider: Provider = modelData?.provider ?? "openai";

  return (
    <div
      data-slot="message-pending"
      className={cn(
        "flex w-full shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-foreground",
        "bg-background/80",
        "shadow-sm",
        "backdrop-blur-md backdrop-saturate-150",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
      )}
    >
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-xl",
          "bg-primary/20 ring-1 ring-primary/25",
        )}
      >
        <Icons.provider provider={provider} className="size-7" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {modelName}

            {showEffort && (
              <span className="ml-1 text-xs font-medium text-muted-foreground capitalize">
                ({effort})
              </span>
            )}
          </p>

          <div className="flex items-center gap-1 rounded-full border border-primary/30 px-2 py-0.5 text-xs font-semibold text-primary">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary/70 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Pending
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2 text-sm text-foreground/80">
          <Icons.loading className="size-5 fill-primary stroke-primary text-primary" />

          <span className="motion-reduce:hidden">
            <Shimmer duration={1.2}>Thinking…</Shimmer>
          </span>

          <span className="hidden font-medium motion-reduce:block">Thinking…</span>
        </div>
      </div>
    </div>
  );
}
