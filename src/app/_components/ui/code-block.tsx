"use client";

import * as React from "react";

import { CodeBlockHeader, CodeInlinePane, ExpandFooter, FullCodeOverlay } from "./code-block-parts";

import { useChatStore } from "@/lib/chat/store";
import { useIsMobile } from "@/lib/hooks/use-mobile";

type CodeBlockProps = React.ComponentProps<"div"> & {
  code: string;
  language?: string;
  theme?: string;
};

function trimOneEdgeNewline(input: string): string {
  let s = input;

  if (s.startsWith("\r\n")) {
    s = s.slice(2);
  } else if (s.startsWith("\n")) {
    s = s.slice(1);
  }

  if (s.endsWith("\r\n")) {
    s = s.slice(0, -2);
  } else if (s.endsWith("\n")) {
    s = s.slice(0, -1);
  }

  return s;
}

export function ShikiCodeBlock({ language, code }: CodeBlockProps) {
  const wrapline = useChatStore((state) => state.wrapline);
  const toggleWrapline = useChatStore((state) => state.toggleWrapline);
  const isMobile = useIsMobile();

  const [open, setOpen] = React.useState(false);

  const normalizedFull = React.useMemo(() => {
    const onceTrimmed = trimOneEdgeNewline(code);
    return onceTrimmed.replace(/\r\n/g, "\n");
  }, [code]);

  const lines = React.useMemo(() => normalizedFull.split("\n"), [normalizedFull]);
  const totalLines = lines.length;
  const previewText = React.useMemo(() => lines.slice(0, 10).join("\n"), [lines]);

  const langKey = language === "assembly" ? "asm" : language;

  return (
    <div className="codeblock relative overflow-hidden rounded-md border">
      <CodeBlockHeader code={code} />

      <div className="flex flex-col justify-end overflow-hidden text-sm">
        <CodeInlinePane wrapline={wrapline} code={previewText} langKey={langKey} />
        <ExpandFooter totalLines={totalLines} onExpand={() => setOpen(true)} />
      </div>

      {totalLines > 10 ? (
        <FullCodeOverlay
          open={open}
          onOpenChange={setOpen}
          isMobile={isMobile}
          language={language}
          wrapline={wrapline}
          onToggleWrapline={toggleWrapline}
          code={code}
          normalizedFull={normalizedFull}
          langKey={langKey}
        />
      ) : null}
    </div>
  );
}
