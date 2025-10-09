import { Collapsible } from "@base-ui-components/react/collapsible";
import { BrainIcon, ChevronRightIcon } from "lucide-react";

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
  if (typeof message.reasoning !== "string" || status === "error") return null;

  const hasReasoningContent = message.reasoning.length > 0;
  const isGeneratingInitialResponse = status === "streaming" && message.content.length === 0;

  return (
    <div data-slot="thinking-toggle" className="px-1.5">
      <Collapsible.Root
        defaultOpen={false}
        className="mb-2 w-full rounded-md border bg-card backdrop-blur-md backdrop-contrast-150"
      >
        <Collapsible.Trigger
          disabled={!hasReasoningContent}
          className="group flex w-full items-center justify-between px-4 py-2 font-medium outline-none"
        >
          <div className="group flex items-center gap-2">
            <BrainIcon className="size-5" />

            <p>
              Thinking{" "}
              {message.metadata?.durations?.reasoning && (
                <span className="text-sm">
                  - Thinking for {format.time(message.metadata.durations.reasoning / 1000)}
                </span>
              )}
            </p>
          </div>

          <ThinkingSummary
            reasoning={message.reasoning}
            hasReasoningContent={hasReasoningContent}
            isGeneratingInitialResponse={isGeneratingInitialResponse}
          />
        </Collapsible.Trigger>

        {hasReasoningContent && (
          <Collapsible.Panel className="h-[var(--collapsible-panel-height)] space-y-4 p-4 transition-[height] ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
            <MemoizedMarkdown id={messageId + "-thinking"} content={message.reasoning} />
          </Collapsible.Panel>
        )}
      </Collapsible.Root>
    </div>
  );
}

type ThinkingSummaryProps = {
  reasoning: string;
  hasReasoningContent: boolean;
  isGeneratingInitialResponse: boolean;
};

function ThinkingSummary({
  reasoning,
  hasReasoningContent,
  isGeneratingInitialResponse,
}: ThinkingSummaryProps) {
  if (!isGeneratingInitialResponse) {
    return (
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-[rotate] duration-400 ease-out group-data-[panel-open]:rotate-90" />
    );
  }

  const content = hasReasoningContent ? getLatestHeading(reasoning) : "...";
  return <span className="font-semibold text-muted-foreground/70 text-sm">{content}</span>;
}
