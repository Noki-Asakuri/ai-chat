import { Shimmer } from "../ui/ai-elements/shimmer";

import {
  buildAssistantMessageIdentity,
  MessageIdentityAvatar,
  MessageIdentityHeader,
} from "./message-identity";

import { Icons } from "@/components/ui/icons";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessagePendingProps = {
  metadata: ChatMessage["metadata"];
};

export function MessagePending({ metadata }: MessagePendingProps) {
  const assistantIdentity = buildAssistantMessageIdentity(
    metadata?.model.request,
    metadata?.modelParams?.effort,
  );
  const identity = { kind: "assistant" as const, assistant: assistantIdentity };

  return (
    <div
      data-slot="message-pending"
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-foreground",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
      )}
    >
      <div className="flex shrink-0 pt-0.5">
        <MessageIdentityAvatar identity={identity} />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <MessageIdentityHeader identity={identity} />

          <div className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary/70 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Live
          </div>
        </div>

        <div className="flex max-w-3xl items-center gap-2 rounded-2xl border border-border/50 bg-card/70 px-4 py-3 shadow-sm backdrop-blur-md backdrop-saturate-150">
          <Icons.loading className="size-5 fill-primary stroke-primary text-primary" />

          <span className="motion-reduce:hidden">
            <Shimmer duration={1.2}>Thinking...</Shimmer>
          </span>

          <span className="hidden font-medium motion-reduce:block">Thinking...</span>
        </div>
      </div>
    </div>
  );
}
