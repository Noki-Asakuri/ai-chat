"use client";

import { transformerColorizedBrackets } from "@shikijs/colorized-brackets";
import { EllipsisIcon, ExpandIcon, ShrinkIcon, TextIcon, WrapTextIcon } from "lucide-react";
import * as React from "react";
import { useShikiHighlighter } from "react-shiki";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "./button";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";

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

const languageDisplayName: Record<
  string,
  { name: string; icon?: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode }
> = {
  ts: { name: "TypeScript", icon: Icons.typescript },
  js: { name: "JavaScript", icon: Icons.javascript },
  cpp: { name: "C++", icon: Icons.cpp },
  cs: { name: "C#", icon: Icons.csharp },
  py: { name: "Python", icon: Icons.python },
  kt: { name: "Kotlin", icon: Icons.kotlin },
  rs: { name: "Rust", icon: Icons.rust },
  php: { name: "PHP", icon: Icons.php },
  rb: { name: "Ruby", icon: Icons.ruby },
  md: { name: "Markdown", icon: Icons.markdown },
  css: { name: "CSS", icon: Icons.css },
  html: { name: "HTML", icon: Icons.html },
  sh: { name: "Shell" },
};

export function ShikiCodeBlock({ language, code }: CodeBlockProps) {
  const wrapline = useChatStore((state) => state.wrapline);
  const toggleWrapline = useChatStore((state) => state.toggleWrapline);

  const [expanded, setExpanded] = React.useState(false);

  const normalizedFull = React.useMemo(() => {
    const onceTrimmed = trimOneEdgeNewline(code);
    return onceTrimmed.replace(/\r\n/g, "\n");
  }, [code]);

  const lines = React.useMemo(() => normalizedFull.split("\n"), [normalizedFull]);
  const totalLines = lines.length;
  const moreCount = totalLines > 15 ? totalLines - 15 : 0;

  const langKey = React.useMemo(() => {
    const key = language === "assembly" ? "asm" : language;
    return key?.toLowerCase();
  }, [language]);

  const highlighted = useShikiHighlighter(normalizedFull, langKey, "one-dark-pro", {
    delay: 50,
    transformers: [transformerColorizedBrackets()],
  });

  const containerMaxHeight = React.useMemo(() => {
    if (expanded || totalLines <= 15) return undefined;

    const lineHeightPx = 20;
    const verticalPadding = 8;
    return `${15 * lineHeightPx + verticalPadding}px`;
  }, [expanded, totalLines]);

  const fileName = lines[0]?.match(
    /(?:^|.*[\/\\])([A-Za-z0-9._-]+\.[A-Za-z0-9]+)(?=[^A-Za-z0-9._-]*$)/,
  );

  const languageData = languageDisplayName[langKey ?? "plaintext"];
  const Icon = languageData?.icon;

  return (
    <div className="codeblock relative overflow-hidden rounded-md border">
      <div className="pointer-events-none flex items-center justify-between border-b px-2 py-1">
        <div className="flex items-center justify-center gap-1.5">
          {Icon && <Icon className="size-5 rounded-sm" />}{" "}
          <span>{languageData?.name ?? langKey ?? "plaintext"}</span>
          <span className="text-primary text-xs">{totalLines} lines</span>
        </div>

        {fileName && <span className="text-primary text-xs">{fileName[1]}</span>}

        <div className="pointer-events-auto flex items-center gap-1">
          {totalLines > 15 ? (
            <ButtonWithTip
              title={expanded ? "Collapse" : "Expand"}
              side="top"
              variant="ghost"
              className="size-8"
              onMouseDown={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? <ShrinkIcon className="size-4" /> : <ExpandIcon className="size-4" />}
            </ButtonWithTip>
          ) : null}

          <ButtonWithTip
            title="Wrap"
            side="top"
            variant="ghost"
            className="size-8"
            onMouseDown={toggleWrapline}
          >
            {wrapline ? <TextIcon className="size-4" /> : <WrapTextIcon className="size-4" />}
          </ButtonWithTip>

          <CopyButton content={code} className="size-8" />
        </div>
      </div>

      <div
        style={{ scrollbarGutter: "stable both-edges", height: containerMaxHeight }}
        className={cn(
          "custom-scroll codeblock w-full overflow-auto px-1 py-2 pr-10 font-mono text-sm transition-[height] *:!bg-transparent",
          { "*:text-wrap *:wrap-anywhere": wrapline },
        )}
      >
        {highlighted ?? <pre>{normalizedFull}</pre>}
      </div>

      {!expanded && moreCount > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
          <button
            type="button"
            className="bg-card hover:bg-card/70 pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors"
            onMouseDown={() => setExpanded(true)}
          >
            <EllipsisIcon className="size-4" /> {moreCount} more lines
          </button>
        </div>
      ) : null}
    </div>
  );
}
