import { Collapsible } from "@base-ui-components/react/collapsible";
import { Loader2Icon, PlusIcon, SparkleIcon } from "lucide-react";

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
    <Collapsible.Root className="mb-2 w-full space-y-2" defaultOpen={false}>
      <Collapsible.Trigger className="group bg-background/80 flex w-full items-center justify-between rounded-md border px-4 py-2 font-medium backdrop-blur-md backdrop-saturate-150 outline-none">
        <div className="group flex items-center gap-2">
          {isGeneratingInitialResponse ? (
            <Loader2Icon className="text-muted-foreground size-5 shrink-0 animate-spin" />
          ) : (
            <SparkleIcon className="size-5" />
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
          <PlusIcon className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 ease-out group-data-[panel-open]:rotate-45" />
        )}
      </Collapsible.Trigger>

      <Collapsible.Panel className="bg-background/80 h-[var(--collapsible-panel-height)] space-y-4 rounded-md border p-4 backdrop-blur-md backdrop-saturate-150 transition-[height] ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        <MemoizedMarkdown id={messageId + "-thinking"} content={message.reasoning} />
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
