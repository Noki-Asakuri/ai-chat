import { Collapsible } from "@base-ui-components/react/collapsible";
import { Loader2Icon, PlusIcon, SparkleIcon } from "lucide-react";

import { MemoizedMarkdown } from "../markdown";

import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";

type ThinkingToggleProps = {
  messageId: string;
  reasoning?: string;
  finished: boolean;
  status: ChatMessage["status"];
  tokens?: number;
};

export function ThinkingToggle({
  messageId,
  reasoning,
  finished,
  status,
  tokens,
}: ThinkingToggleProps) {
  if (!reasoning || status === "error") return null;

  return (
    <Collapsible.Root className="my-4 w-full space-y-2" defaultOpen={false}>
      <Collapsible.Trigger className="group bg-background/80 flex w-full items-center justify-between rounded-md border px-4 py-2 font-medium backdrop-blur-md backdrop-saturate-150 outline-none">
        <div className="group flex items-center gap-2">
          <SparkleIcon className="size-5" />
          <p>
            Thinking{" "}
            {tokens && <span className="text-sm">- {format.number(tokens)} Thinking Tokens</span>}
          </p>
        </div>

        {status === "streaming" && !finished ? (
          <Loader2Icon className="text-muted-foreground size-5 shrink-0 animate-spin" />
        ) : (
          <PlusIcon className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 ease-out group-data-[panel-open]:rotate-45" />
        )}
      </Collapsible.Trigger>

      <Collapsible.Panel className="bg-background/80 h-[var(--collapsible-panel-height)] space-y-4 rounded-md border px-4 py-2 backdrop-blur-md backdrop-saturate-150 transition-[height] ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        <MemoizedMarkdown id={messageId + "-thinking"} content={reasoning} />
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
