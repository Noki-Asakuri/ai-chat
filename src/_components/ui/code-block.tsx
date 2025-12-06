"use client";

import { transformerColorizedBrackets } from "@shikijs/colorized-brackets";
import { EllipsisIcon, ExpandIcon, ShrinkIcon, TextIcon, WrapTextIcon } from "lucide-react";
import * as React from "react";
import { useShikiHighlighter, type HighlighterOptions } from "react-shiki";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "./button";
import { Icons } from "./icons";

import { useChatStore } from "@/lib/chat/store";
import { useThrottledDebouncedValue } from "@/lib/hooks/use-throttled-debounced-value";
import { getHighlightFromCache, setHighlightInCache } from "@/lib/code-highlight-cache";
import { cn } from "@/lib/utils";

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
  typescript: { name: "TypeScript", icon: Icons.typescript },
  tsx: { name: "TSX", icon: Icons.tsx },
  jsx: { name: "JSX", icon: Icons.jsx },
  js: { name: "JavaScript", icon: Icons.javascript },
  javascript: { name: "JavaScript", icon: Icons.javascript },
  cpp: { name: "C++", icon: Icons.cpp },
  cs: { name: "C#", icon: Icons.csharp },
  csharp: { name: "C#", icon: Icons.csharp },
  py: { name: "Python", icon: Icons.python },
  python: { name: "Python", icon: Icons.python },
  kt: { name: "Kotlin", icon: Icons.kotlin },
  kotlin: { name: "Kotlin", icon: Icons.kotlin },
  rs: { name: "Rust", icon: Icons.rust },
  rust: { name: "Rust", icon: Icons.rust },
  php: { name: "PHP", icon: Icons.php },
  rb: { name: "Ruby", icon: Icons.ruby },
  ruby: { name: "Ruby", icon: Icons.ruby },
  md: { name: "Markdown", icon: Icons.markdown },
  markdown: { name: "Markdown", icon: Icons.markdown },
  css: { name: "CSS", icon: Icons.css },
  html: { name: "HTML", icon: Icons.html },
  sql: { name: "SQL" },
  sh: { name: "Shell" },
};

type CodeBlockProps = { language?: string | null; code: string };

const LINE_CLAMP = 15;
const FILE_NAME_RE = /(?:^|.*[/\\])([A-Za-z0-9._-]+\.[A-Za-z0-9]+)(?=[^A-Za-z0-9._-]*$)/;

const transformersOnce = [transformerColorizedBrackets()];

function normalizeCode(input: string): string {
  const onceTrimmed = trimOneEdgeNewline(input);
  return onceTrimmed.replace(/\r\n/g, "\n");
}

function lineStats(s: string): { total: number; first?: string } {
  if (s.length === 0) return { total: 1 };
  const firstBreak = s.indexOf("\n");
  if (firstBreak === -1) return { total: 1, first: s };
  let total = 1;

  for (let i = firstBreak + 1; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) total++;
  }
  return { total, first: s.slice(0, firstBreak) };
}

function getRenderDelayFromLines(lineCount: number): {
  minHighlightInterval: number;
  debounceMs: number;
} {
  const smallThreshold = 50;
  const mediumThreshold = 150;
  const largeThreshold = 300;

  if (lineCount < smallThreshold) {
    // Small blocks: highlight frequently
    return {
      minHighlightInterval: 100,
      debounceMs: 500,
    };
  }
  if (lineCount < mediumThreshold) {
    // Medium blocks: reduce highlight frequency
    return {
      minHighlightInterval: 500,
      debounceMs: 800,
    };
  }
  if (lineCount < largeThreshold) {
    // Large blocks: highlight rarely, rely on debounce
    return {
      minHighlightInterval: 1500,
      debounceMs: 1200,
    };
  }
  // Very large blocks: skip immediate highlights entirely during streaming
  return {
    minHighlightInterval: Number.POSITIVE_INFINITY,
    debounceMs: 1500,
  };
}

type CodeBlockHeaderProps = {
  langKey: string;
  totalLines: number;
  firstLine?: string;
};

const CodeBlockHeader = React.memo(function CodeBlockHeader(props: CodeBlockHeaderProps) {
  const fileName = React.useMemo(
    () => (props.firstLine ? FILE_NAME_RE.exec(props.firstLine) : null),
    [props.firstLine],
  );

  const languageData = languageDisplayName[props.langKey];
  const Icon = languageData?.icon;

  return (
    <>
      <div className="flex items-center justify-center gap-1.5">
        {Icon && <Icon className="size-5 rounded-sm" />}
        <span className="capitalize">{languageData?.name ?? props.langKey}</span>
        <span className="text-xs text-primary">{props.totalLines} lines</span>
      </div>

      {fileName?.[1] && (
        <span className="absolute w-[calc(100%-16px)] text-center text-sm text-primary">
          {fileName[1]}
        </span>
      )}
    </>
  );
});

const HighlightPane = React.memo(function HighlightPane(props: {
  code: string;
  langKey: string;
  height?: string;
  wrapline: boolean;
}) {
  const shikiOptions = React.useMemo(
    (): HighlighterOptions => ({
      delay: 50,
      tabindex: -1,
      transformers: transformersOnce,
      outputFormat: "html",
    }),
    [],
  );

  const className = React.useMemo(() => {
    return cn(
      "custom-scroll codeblock *:!bg-transparent w-full overflow-auto px-2 py-2 font-mono text-sm transition-[height]",
      { "*:wrap-anywhere *:text-wrap": props.wrapline },
    );
  }, [props.wrapline]);

  const cacheKey = React.useMemo(
    () => `${props.langKey}:${props.code}`,
    [props.langKey, props.code],
  );

  const highlighted = useShikiHighlighter(
    props.code,
    props.langKey,
    "one-dark-pro",
    shikiOptions,
  ) as string | null;

  React.useEffect(() => {
    if (highlighted && cacheKey) {
      setHighlightInCache(cacheKey, highlighted);
    }
  }, [cacheKey, highlighted]);

  const cached = getHighlightFromCache(cacheKey);

  if (!highlighted && !cached) {
    return (
      <pre
        tabIndex={-1}
        className={className}
        style={{ scrollbarGutter: "stable both-edges", height: props.height }}
      >
        {props.code}
      </pre>
    );
  }

  const html = highlighted ?? cached!;

  return (
    <div
      tabIndex={-1}
      className={className}
      style={{ scrollbarGutter: "stable both-edges", height: props.height }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export const ShikiCodeBlock = React.memo(function ShikiCodeBlock({
  language,
  code,
}: CodeBlockProps) {
  const wrapline = useChatStore((state) => state.wrapline);
  const defaultOpen = useChatStore((state) => state.userCustomization?.showFullCode ?? false);

  const [expanded, setExpanded] = React.useState(defaultOpen);
  const onToggleExpanded = React.useCallback(() => setExpanded((v) => !v), []);
  const onExpandAll = React.useCallback(() => setExpanded(true), []);

  const normalizedFull = React.useMemo(() => normalizeCode(code), [code]);

  const { total: totalLines, first: firstLine } = React.useMemo(
    () => lineStats(normalizedFull),
    [normalizedFull],
  );

  const { debounceMs } = React.useMemo(() => getRenderDelayFromLines(totalLines), [totalLines]);
  const throttledCode = useThrottledDebouncedValue(normalizedFull, debounceMs);

  const langKey = React.useMemo(() => {
    const key = language === "assembly" ? "asm" : (language ?? "plaintext");
    return key.toLowerCase();
  }, [language]);

  const moreCount = totalLines > LINE_CLAMP ? totalLines - LINE_CLAMP : 0;

  const containerMaxHeight = React.useMemo(() => {
    if (expanded || totalLines <= LINE_CLAMP) return undefined;
    const lineHeightPx = 20;
    const verticalPadding = 8;

    return `${LINE_CLAMP * lineHeightPx + verticalPadding}px`;
  }, [expanded, totalLines]);

  return (
    <div className="codeblock relative overflow-hidden rounded-md border bg-background/80 text-foreground">
      <div className="pointer-events-none relative flex items-center justify-between border-b px-2 py-1">
        <CodeBlockHeader langKey={langKey} totalLines={totalLines} firstLine={firstLine} />

        <div className="pointer-events-auto flex items-center gap-1">
          {totalLines > LINE_CLAMP && (
            <ButtonWithTip
              title={expanded ? "Collapse" : "Expand"}
              side="top"
              variant="ghost"
              className="size-8"
              onMouseDown={onToggleExpanded}
              aria-expanded={expanded}
            >
              {expanded ? <ShrinkIcon className="size-4" /> : <ExpandIcon className="size-4" />}
            </ButtonWithTip>
          )}

          <ButtonWithTip
            title="Wrap"
            side="top"
            variant="ghost"
            className="size-8"
            onMouseDown={useChatStore.getState().toggleWrapline}
          >
            {wrapline ? <TextIcon className="size-4" /> : <WrapTextIcon className="size-4" />}
          </ButtonWithTip>

          {/* Always copy the most up-to-date code */}
          <CopyButton content={code} className="size-8" />
        </div>
      </div>

      <HighlightPane
        code={throttledCode}
        langKey={langKey}
        height={containerMaxHeight}
        wrapline={wrapline}
      />

      {!expanded && moreCount > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
          <button
            type="button"
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs transition-colors hover:bg-card/70"
            onMouseDown={onExpandAll}
          >
            <EllipsisIcon className="size-4" /> {moreCount} more lines
          </button>
        </div>
      )}
    </div>
  );
});
