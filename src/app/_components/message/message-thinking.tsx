import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Loader2Icon, PlusIcon, SparkleIcon } from "lucide-react";

import { MemoizedMarkdown } from "../markdown";
import { Accordion, AccordionItem } from "../ui/accordion";

import type { ChatMessage } from "@/lib/types";
import { cn, format } from "@/lib/utils";

export function ThinkingToggle({
  messageId,
  reasoning,
  finished,
  status,
  tokens,
}: {
  messageId: string;
  reasoning?: string;
  finished: boolean;
  status: ChatMessage["status"];
  tokens?: number;
}) {
  if (!reasoning || status === "error") return null;
  const defaultValue = status === "streaming" ? `${messageId}-thinking` : undefined;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultValue}
      className="my-4 w-full space-y-2"
    >
      <AccordionItem
        value={messageId + "-thinking"}
        className="bg-secondary rounded-md border-none"
      >
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger
            className={cn(
              "flex w-max flex-1 cursor-pointer items-center justify-between px-4 py-4 font-medium transition-all outline-none",
              { "[&[data-state=open]>svg]:rotate-45": status !== "streaming" },
            )}
          >
            <div className="group flex items-center gap-2">
              <SparkleIcon className="size-5" />
              <p>
                Thinking{" "}
                {tokens && (
                  <span className="text-sm">- {format.number(tokens)} Thinking Tokens</span>
                )}
              </p>
            </div>

            {status === "streaming" && !finished ? (
              <Loader2Icon className="text-muted-foreground size-5 shrink-0 animate-spin" />
            ) : (
              <PlusIcon className="text-muted-foreground size-5 shrink-0 transition-transform duration-200" />
            )}
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>

        <AccordionPrimitive.AccordionContent>
          <hr />
          <div className="prose dark:prose-invert max-w-none space-y-2 px-4 py-4">
            <MemoizedMarkdown id={messageId + "-thinking"} content={reasoning} />
          </div>
        </AccordionPrimitive.AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
