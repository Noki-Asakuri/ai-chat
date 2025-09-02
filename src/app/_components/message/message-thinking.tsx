import { Collapsible } from "@base-ui-components/react/collapsible";
import { BrainIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";

import { MemoizedMarkdown } from "../message/message-markdown";

import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";

type ThinkingToggleProps = {
  messageId: string;
  status: ChatMessage["status"];
  message: {
    content: string;
    reasoning?: string;
    metadata?: ChatMessage["metadata"];
  };
};

function getLatestHeading(text: string) {
  const headingRegex = /\*\*(.*?)\*\*/g;
  const matches = Array.from(text.matchAll(headingRegex));

  const lastMatch = matches.pop();

  return lastMatch?.[1];
}

export function ThinkingToggle({ messageId, status, message }: ThinkingToggleProps) {
  const isGeneratingInitialResponse = status === "streaming" && message.content.length === 0;
  if (!message.reasoning || status === "error") return null;

  return (
    <div data-slot="thinking-toggle" className="px-1.5">
      <Collapsible.Root
        defaultOpen={false}
        className="bg-card mb-2 w-full rounded-md border backdrop-blur-md backdrop-contrast-150"
      >
        <Collapsible.Trigger className="group flex w-full items-center justify-between px-4 py-2 font-medium outline-none">
          <div className="group flex items-center gap-2">
            {isGeneratingInitialResponse ? (
              <Loader2Icon className="text-muted-foreground size-5 shrink-0 animate-spin" />
            ) : (
              <BrainIcon className="size-5" />
            )}

            <p>
              Thinking{" "}
              {message.metadata?.durations?.reasoning && (
                <span className="text-sm">
                  - Thinking for {format.time(message.metadata.durations.reasoning / 1000)}
                </span>
              )}
            </p>
          </div>

          {isGeneratingInitialResponse ? (
            <span className="text-muted-foreground/70 text-sm font-semibold">
              {getLatestHeading(message.reasoning)}
            </span>
          ) : (
            <ChevronRightIcon className="text-muted-foreground size-5 shrink-0 transition-[rotate] duration-400 ease-out group-data-[panel-open]:rotate-90" />
          )}
        </Collapsible.Trigger>

        <Collapsible.Panel className="h-[var(--collapsible-panel-height)] space-y-4 p-4 transition-[height] ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
          <MemoizedMarkdown id={messageId + "-thinking"} content={message.reasoning} />
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
