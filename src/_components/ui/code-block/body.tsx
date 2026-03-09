import type { HighlightResult } from "@streamdown/code";
import { EllipsisIcon } from "lucide-react";
import { type ComponentProps, type CSSProperties, memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { LINE_CLAMP } from ".";
import { useCodeBlockContext } from "./context";

const CODE_LINE_HEIGHT_PX = 20;
const COLLAPSED_VERTICAL_PADDING_PX = 8;

type CodeBlockBodyProps = ComponentProps<"div"> & {
  result: HighlightResult;
  language: string;
  startLineIndex?: number;
  endLineIndex?: number;
  virtualPaddingTopPx?: number;
  virtualPaddingBottomPx?: number;
};

const LINE_NUMBER_CLASSES = cn(
  "relative block pl-[var(--sdm-line-gutter)]",
  "before:absolute before:top-0 before:left-0",
  "before:content-[counter(line)]",
  "before:[counter-increment:line]",
  "before:w-[var(--sdm-line-number-width)]",
  "before:select-none",
  "before:whitespace-nowrap",
  "before:text-right",
  "before:font-mono",
  "before:text-muted-foreground/50",
);

/**
 * Parse a CSS declarations string (e.g. Shiki's rootStyle) into a style object.
 * This extracts CSS custom properties like --shiki-dark-bg from Shiki's dual theme output.
 */
function parseRootStyle(rootStyle: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const decl of rootStyle.split(";")) {
    const idx = decl.indexOf(":");
    if (idx > 0) {
      const prop = decl.slice(0, idx).trim();
      const val = decl.slice(idx + 1).trim();
      if (prop && val) {
        style[prop] = val;
      }
    }
  }
  return style;
}

/**
 * The body of the code block. This component is memoized to prevent unnecessary re-renders.
 * The code originates from the `@streamdown` package
 *
 * @see https://github.com/vercel/streamdown/blob/main/packages/streamdown/lib/code-block/body.tsx
 */
export const CodeBlockContent = memo(
  ({
    children: _code,
    result,
    language,
    className,
    startLineIndex = 0,
    endLineIndex = Number.POSITIVE_INFINITY,
    virtualPaddingTopPx = 0,
    virtualPaddingBottomPx = 0,
    ...rest
  }: CodeBlockBodyProps) => {
    const { wrapline } = useCodeBlockContext();

    // Use CSS custom properties instead of direct inline styles so that
    // dark-mode Tailwind classes can override without !important.
    // This is necessary because !important syntax differs between Tailwind v3 and v4.
    const preStyle = useMemo(() => {
      const style: Record<string, string> = {};

      if (result.bg) {
        style["--sdm-bg"] = result.bg;
      }
      if (result.fg) {
        style["--sdm-fg"] = result.fg;
      }

      // Parse rootStyle for Shiki dark theme CSS variables (--shiki-dark-bg, etc.)
      if (result.rootStyle) {
        Object.assign(style, parseRootStyle(result.rootStyle));
      }

      if (virtualPaddingTopPx > 0) {
        style.paddingTop = `${virtualPaddingTopPx}px`;
      }

      if (virtualPaddingBottomPx > 0) {
        style.paddingBottom = `${virtualPaddingBottomPx}px`;
      }

      return style as CSSProperties;
    }, [result.bg, result.fg, result.rootStyle, virtualPaddingBottomPx, virtualPaddingTopPx]);

    const boundedStartLineIndex = Math.max(0, startLineIndex);
    const boundedEndLineIndex = Math.min(
      result.tokens.length,
      Math.max(boundedStartLineIndex, endLineIndex),
    );

    const lineNumberGutterWidthCh = String(Math.max(1, boundedEndLineIndex)).length + 1;
    const renderedRows = useMemo(() => {
      const rows: React.ReactNode[] = [];

      for (let lineIndex = boundedStartLineIndex; lineIndex < boundedEndLineIndex; lineIndex++) {
        const row = result.tokens[lineIndex] ?? [];

        rows.push(
          <span className={LINE_NUMBER_CLASSES} key={lineIndex}>
            {row.length === 0 && <br />}

            {row.map((token, tokenIndex) => {
              // Shiki dual-theme tokens put direct CSS properties (color,
              // background-color) into htmlStyle alongside CSS custom
              // properties (--shiki-dark, etc). Direct properties as inline
              // styles override the Tailwind class-based dark mode approach,
              // so we redirect them to CSS custom properties instead.
              const tokenStyle: Record<string, string> = {};
              let hasBg = Boolean(token.bgColor);

              if (token.color) {
                tokenStyle["--sdm-c"] = token.color;
              }

              if (token.bgColor) {
                tokenStyle["--sdm-tbg"] = token.bgColor;
              }

              if (token.htmlStyle) {
                for (const [key, value] of Object.entries(token.htmlStyle)) {
                  if (key === "color") {
                    tokenStyle["--sdm-c"] = value;
                  } else if (key === "background-color") {
                    tokenStyle["--sdm-tbg"] = value;
                    hasBg = true;
                  } else {
                    tokenStyle[key] = value;
                  }
                }
              }

              return (
                <span
                  className={cn(
                    "text-[var(--sdm-c,inherit)]",
                    "dark:text-[var(--shiki-dark,var(--sdm-c,inherit))]",
                    hasBg && "bg-[var(--sdm-tbg)]",
                    hasBg && "dark:bg-[var(--shiki-dark-bg,var(--sdm-tbg))]",
                  )}
                  // biome-ignore lint/suspicious/noArrayIndexKey: "This is a stable key."
                  key={tokenIndex}
                  style={tokenStyle as CSSProperties}
                  {...token.htmlAttrs}
                >
                  {token.content}
                </span>
              );
            })}
          </span>,
        );
      }

      return rows;
    }, [boundedEndLineIndex, boundedStartLineIndex, result.tokens]);

    const codeStyle = useMemo<CSSProperties>(
      () => ({
        counterReset: `line ${boundedStartLineIndex}`,
        "--sdm-line-number-width": `${lineNumberGutterWidthCh}ch`,
        "--sdm-line-gutter": `calc(var(--sdm-line-number-width) + 1rem)`,
      }),
      [boundedStartLineIndex, lineNumberGutterWidthCh],
    );

    return (
      <div
        className={cn(className, "text-sm", wrapline ? "w-full" : "w-max min-w-full")}
        data-language={language}
        data-streamdown="code-block-body"
        {...rest}
      >
        <pre
          className={cn(
            className,
            "bg-[var(--sdm-bg,inherit)]",
            "dark:bg-[var(--shiki-dark-bg,var(--sdm-bg,inherit))]",
            wrapline
              ? "w-full wrap-anywhere whitespace-pre-wrap"
              : "w-max min-w-full whitespace-pre",
          )}
          style={preStyle}
        >
          <code style={codeStyle}>{renderedRows}</code>
        </pre>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if result tokens actually changed
    return (
      prevProps.result === nextProps.result &&
      prevProps.language === nextProps.language &&
      prevProps.className === nextProps.className &&
      prevProps.startLineIndex === nextProps.startLineIndex &&
      prevProps.endLineIndex === nextProps.endLineIndex &&
      prevProps.virtualPaddingTopPx === nextProps.virtualPaddingTopPx &&
      prevProps.virtualPaddingBottomPx === nextProps.virtualPaddingBottomPx
    );
  },
);

export function CodeBlockBody({ result }: { result: HighlightResult }) {
  const { language, expanded, totalLines, setExpanded, wrapline } = useCodeBlockContext();

  const moreCount = totalLines > LINE_CLAMP ? totalLines - LINE_CLAMP : 0;
  const isCollapsed = !expanded && moreCount > 0;

  const containerMaxHeight = (() => {
    if (!isCollapsed) return undefined;
    return `${LINE_CLAMP * CODE_LINE_HEIGHT_PX + COLLAPSED_VERTICAL_PADDING_PX}px`;
  })();

  return (
    <div className="relative">
      <div
        className={cn(
          "custom-scroll px-3 py-2",
          isCollapsed ? "overflow-auto pb-10" : "overflow-x-auto",
        )}
        data-should-wrap={wrapline ? "true" : "false"}
        style={{ maxHeight: containerMaxHeight }}
      >
        <CodeBlockContent
          result={result}
          language={language}
          startLineIndex={0}
          endLineIndex={result.tokens.length}
        />
      </div>

      {isCollapsed && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
          <button
            type="button"
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs transition-colors hover:bg-card/70"
            onMouseDown={() => setExpanded(true)}
          >
            <EllipsisIcon className="size-4" /> {moreCount} more lines
          </button>
        </div>
      )}
    </div>
  );
}
