import { useState } from "react";
import { useShikiHighlighter } from "react-shiki";
import { CopyIcon, CopyCheckIcon, TextIcon, WrapTextIcon } from "lucide-react";

import { Button } from "./button";
import { ScrollArea, ScrollBar } from "./scroll-area";

import { cn } from "@/lib/utils";

type CodeBlockProps = React.ComponentProps<"div"> & {
  children: string;
  language?: string;
  theme?: string;
};

export function ShikiCodeBlock({ children, language, theme, ...props }: CodeBlockProps) {
  const [wrapline, setWrapline] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const highlightedCode = useShikiHighlighter(children, language, theme ?? "github-dark-dimmed", { delay: 150 });

  async function copyCodeBlock() {
    await navigator.clipboard.writeText(children);
    setCopySuccess(true);

    setTimeout(() => setCopySuccess(false), 1000);
  }

  return (
    <div className="code-block not-prose border-border overflow-hidden rounded-md border bg-transparent" {...props}>
      <div className="bg-muted/50 flex w-full items-center justify-between gap-2 px-6 py-1.5">
        <span className="text-lg capitalize">{language}</span>

        <div>
          <Button variant="ghost" className="size-8 cursor-pointer" onMouseDown={() => setWrapline(!wrapline)}>
            {wrapline ? <TextIcon /> : <WrapTextIcon />}
          </Button>

          <Button variant="ghost" className="size-8 cursor-pointer" onMouseDown={copyCodeBlock} disabled={copySuccess}>
            {copySuccess ? <CopyCheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      </div>

      <ScrollArea className="whitespace-nowrap">
        <div
          className={cn("contents *:overflow-x-auto *:px-6 *:py-2", {
            "*:text-wrap *:wrap-anywhere": wrapline,
          })}
        >
          {highlightedCode}
        </div>
        {!wrapline && <ScrollBar orientation="horizontal" />}
      </ScrollArea>
    </div>
  );
}
