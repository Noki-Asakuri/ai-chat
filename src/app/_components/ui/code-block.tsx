import { ChevronDownIcon, TextIcon, WrapTextIcon } from "lucide-react";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { useShikiHighlighter } from "react-shiki";

import { CopyButton } from "../copy-button";
import { Accordion, AccordionContent, AccordionItem } from "./accordion";
import { Button, ButtonWithTip } from "./button";
import { ScrollArea, ScrollBar } from "./scroll-area";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

type CodeBlockProps = React.ComponentProps<"div"> & {
  code: string;
  language?: string;
  theme?: string;
};

export function ShikiCodeBlock({ language, code }: CodeBlockProps) {
  const wrapline = useChatStore((state) => state.wrapline);
  const toggleWrapline = useChatStore((state) => state.toggleWrapline);

  const highlightedCode = useShikiHighlighter(
    code,
    language === "assembly" ? "asm" : language,
    "one-dark-pro",
    { delay: 50 },
  );

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={`${language}-code-block`}
      className="code-block overflow-hidden rounded-md border bg-transparent"
    >
      <AccordionItem value={`${language}-code-block`}>
        <AccordionPrimitive.Header className="relative">
          <div className="bg-muted/50 flex w-full items-center justify-between gap-2 px-2 py-1.5">
            <AccordionPrimitive.Trigger asChild title="Toggle Code Block">
              <Button
                variant="ghost"
                className="size-8 cursor-pointer [&[data-state=open]>svg]:-rotate-180"
              >
                <ChevronDownIcon className="size-4 transition-transform" />
              </Button>
            </AccordionPrimitive.Trigger>

            <span className="font-semibold select-none">{language}</span>

            <div className="space-x-2">
              <ButtonWithTip
                title="Wrap Line"
                side="top"
                variant="ghost"
                className="size-8 cursor-pointer"
                onMouseDown={toggleWrapline}
              >
                {wrapline ? <TextIcon className="size-4" /> : <WrapTextIcon className="size-4" />}
              </ButtonWithTip>

              <CopyButton content={code} />
            </div>
          </div>
        </AccordionPrimitive.Header>

        <AccordionContent className="py-0">
          <ScrollArea
            orientation="horizontal"
            className="whitespace-nowrap"
            viewport={{ className: "max-w-full" }}
          >
            <div
              className={cn("contents font-mono *:overflow-x-auto *:p-3", {
                "*:text-wrap *:wrap-anywhere": wrapline,
              })}
            >
              {highlightedCode}
            </div>

            {!wrapline && <ScrollBar orientation="horizontal" />}
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
