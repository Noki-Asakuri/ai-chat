import { useCopyToClipboard } from "@uidotdev/usehooks";
import { ChevronDownIcon, ChevronUpIcon, CopyCheckIcon, CopyIcon, TextIcon, WrapTextIcon } from "lucide-react";
import { useState } from "react";

import { useShikiHighlighter } from "react-shiki";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { Button } from "./button";
import { ScrollArea, ScrollBar } from "./scroll-area";
import { Accordion, AccordionContent, AccordionItem } from "./accordion";

import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat/store";

type CodeBlockProps = React.ComponentProps<typeof Accordion> & {
  code: string;
  language?: string;
  theme?: string;
};

export function ShikiCodeBlock({ language, code }: CodeBlockProps) {
  const wrapline = useChatStore((state) => state.wrapline);
  const toggleWrapline = useChatStore((state) => state.toggleWrapline);

  const [copySuccess, setCopySuccess] = useState(false);
  const [copiedText, copyToClipboard] = useCopyToClipboard();

  const highlightedCode = useShikiHighlighter(code, language === "assembly" ? "asm" : language, "github-dark-dimmed", {
    delay: 150,
  });

  async function copyCodeBlock() {
    await copyToClipboard(code);
    setCopySuccess(Boolean(copiedText));

    setTimeout(() => setCopySuccess(false), 1000);
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={`${language}-code-block`}
      className="code-block not-prose border-border overflow-hidden rounded-md border bg-transparent"
    >
      <AccordionItem value={`${language}-code-block`}>
        <AccordionPrimitive.Header className="relative">
          <div className="bg-muted/50 flex w-full items-center justify-between gap-2 px-6 py-1.5">
            <span className="font-semibold">{language}</span>

            <div className="absolute right-6 isolate z-50 space-x-2">
              <Button variant="ghost" className="size-8 cursor-pointer" onMouseDown={toggleWrapline}>
                {wrapline ? <TextIcon className="size-4" /> : <WrapTextIcon className="size-4" />}
              </Button>

              <Button variant="ghost" className="size-8 cursor-pointer" onMouseDown={copyCodeBlock}>
                {copySuccess ? <CopyCheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </Button>

              <AccordionPrimitive.Trigger asChild>
                <Button variant="ghost" className="size-8 cursor-pointer [&[data-state=open]>svg]:-rotate-180">
                  <ChevronDownIcon className="size-4 transition-transform" />
                </Button>
              </AccordionPrimitive.Trigger>
            </div>
          </div>
        </AccordionPrimitive.Header>

        <AccordionContent className="py-0">
          <ScrollArea className="whitespace-nowrap" viewportClassName="max-w-full">
            <div
              className={cn("contents font-mono *:overflow-x-auto *:px-6 *:py-2", {
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
