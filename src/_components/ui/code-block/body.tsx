import type { HighlightResult } from "@streamdown/code";
import { EllipsisIcon } from "lucide-react";
import {
  type ComponentProps,
  type CSSProperties,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { LINE_CLAMP } from ".";
import { useCodeBlockContext } from "./context";

const CODE_LINE_HEIGHT_PX = 20;
const COLLAPSED_VERTICAL_PADDING_PX = 8;
const COLLAPSED_OVERSCAN_LINES = 6;
const COLLAPSED_VIRTUALIZATION_MIN_LINES = LINE_CLAMP * 3;

type CodeBlockBodyProps = ComponentProps<"div"> & {
  result: HighlightResult;
  language: string;
  lineNumberOffset?: number;
  virtualPaddingTopPx?: number;
  virtualPaddingBottomPx?: number;
};

// Memoize line numbers class string since it's constant
const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-6",
  "before:mr-4",
  "before:text-right",
  "before:text-muted-foreground/50",
  "before:font-mono",
  "before:select-none",
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
    lineNumberOffset = 0,
    virtualPaddingTopPx = 0,
    virtualPaddingBottomPx = 0,
    ...rest
  }: CodeBlockBodyProps) => {
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

    return (
      <div
        className={cn(className, "overflow-hidden text-sm")}
        data-language={language}
        data-streamdown="code-block-body"
        {...rest}
      >
        <pre
          className={cn(
            className,
            "bg-[var(--sdm-bg,inherit)]",
            "dark:bg-[var(--shiki-dark-bg,var(--sdm-bg,inherit))]",
          )}
          style={preStyle}
        >
          <code style={{ counterReset: `line ${lineNumberOffset}` }}>
            {result.tokens.map((row, index) => (
              <span className={LINE_NUMBER_CLASSES} key={index}>
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
              </span>
            ))}
          </code>
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
      prevProps.lineNumberOffset === nextProps.lineNumberOffset &&
      prevProps.virtualPaddingTopPx === nextProps.virtualPaddingTopPx &&
      prevProps.virtualPaddingBottomPx === nextProps.virtualPaddingBottomPx
    );
  },
);

export function CodeBlockBody({ result }: { result: HighlightResult }) {
  const { language, expanded, totalLines, setExpanded, wrapline } = useCodeBlockContext();
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollRafIdRef = useRef<number | null>(null);
  const latestScrollTopRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);

  const moreCount = totalLines > LINE_CLAMP ? totalLines - LINE_CLAMP : 0;
  const isCollapsed = !expanded && moreCount > 0;
  const lineCount = result.tokens.length;
  const shouldVirtualize =
    isCollapsed && !wrapline && lineCount >= COLLAPSED_VIRTUALIZATION_MIN_LINES;

  const visibleLineCount = LINE_CLAMP + COLLAPSED_OVERSCAN_LINES * 2;
  const virtualStartLine = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / CODE_LINE_HEIGHT_PX) - COLLAPSED_OVERSCAN_LINES)
    : 0;
  const virtualEndLine = shouldVirtualize
    ? Math.min(lineCount, virtualStartLine + visibleLineCount)
    : lineCount;

  const displayResult = useMemo((): HighlightResult => {
    if (!shouldVirtualize) {
      return result;
    }

    return {
      ...result,
      tokens: result.tokens.slice(virtualStartLine, virtualEndLine),
    };
  }, [result, shouldVirtualize, virtualEndLine, virtualStartLine]);

  const virtualPaddingTopPx = shouldVirtualize ? virtualStartLine * CODE_LINE_HEIGHT_PX : 0;
  const virtualPaddingBottomPx = shouldVirtualize
    ? Math.max(0, (lineCount - virtualEndLine) * CODE_LINE_HEIGHT_PX)
    : 0;

  useEffect(() => {
    return function cleanupAnimationFrame() {
      if (scrollRafIdRef.current !== null) {
        cancelAnimationFrame(scrollRafIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCollapsed) {
      latestScrollTopRef.current = 0;
      setScrollTop(0);
      return;
    }

    const element = scrollAreaRef.current;
    if (!element) return;

    latestScrollTopRef.current = element.scrollTop;
    setScrollTop(element.scrollTop);
  }, [isCollapsed]);

  function handleScroll(): void {
    if (!shouldVirtualize) return;

    const element = scrollAreaRef.current;
    if (!element) return;

    latestScrollTopRef.current = element.scrollTop;

    if (scrollRafIdRef.current !== null) {
      return;
    }

    scrollRafIdRef.current = requestAnimationFrame(() => {
      scrollRafIdRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
  }

  const containerMaxHeight = (() => {
    if (!isCollapsed) return undefined;
    return `${LINE_CLAMP * CODE_LINE_HEIGHT_PX + COLLAPSED_VERTICAL_PADDING_PX}px`;
  })();

  return (
    <div className="relative">
      <div
        ref={scrollAreaRef}
        className={cn(
          "px-3 py-2",
          isCollapsed ? "custom-scroll overflow-auto pb-10" : "overflow-hidden",
        )}
        style={{ maxHeight: containerMaxHeight }}
        onScroll={handleScroll}
      >
        <CodeBlockContent
          result={displayResult}
          language={language}
          lineNumberOffset={virtualStartLine}
          virtualPaddingTopPx={virtualPaddingTopPx}
          virtualPaddingBottomPx={virtualPaddingBottomPx}
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
