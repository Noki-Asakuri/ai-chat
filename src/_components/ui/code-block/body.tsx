import type { HighlightResult } from "@streamdown/code";
import { type ComponentProps, type CSSProperties, memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { LINE_CLAMP } from ".";
import { useCodeBlockContext } from "./context";
import { EllipsisIcon } from "lucide-react";

type CodeBlockBodyProps = ComponentProps<"div"> & {
  result: HighlightResult;
  language: string;
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
const parseRootStyle = (rootStyle: string): Record<string, string> => {
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
};

/**
 * The body of the code block. This component is memoized to prevent unnecessary re-renders.
 * The code originates from the `@streamdown` package
 *
 * @see https://github.com/vercel/streamdown/blob/main/packages/streamdown/lib/code-block/body.tsx
 */
export const CodeBlockContent = memo(
  ({ children: _code, result, language, className, ...rest }: CodeBlockBodyProps) => {
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

      return style as CSSProperties;
    }, [result.bg, result.fg, result.rootStyle]);

    console.log(result.tokens);

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
            "bg-[var(--sdm-bg,inherit]",
            "dark:bg-[var(--shiki-dark-bg,var(--sdm-bg,inherit)]",
          )}
          style={preStyle}
        >
          <code className="[counter-increment:line_0] [counter-reset:line]">
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
      prevProps.className === nextProps.className
    );
  },
);

export function CodeBlockBody({ result }: { result: HighlightResult }) {
  const { language } = useCodeBlockContext();
  const { expanded, totalLines, setExpanded } = useCodeBlockContext();

  const moreCount = totalLines > LINE_CLAMP ? totalLines - LINE_CLAMP : 0;
  const isCollapsed = !expanded && moreCount > 0;

  const containerMaxHeight = (() => {
    if (!isCollapsed) return undefined;
    const lineHeightPx = 20;
    const verticalPadding = 8;

    return `${LINE_CLAMP * lineHeightPx + verticalPadding}px`;
  })();

  return (
    <div className="relative">
      <div
        className={cn(
          "px-3 py-2",
          isCollapsed ? "custom-scroll overflow-auto pb-10" : "overflow-hidden",
        )}
        style={{ maxHeight: containerMaxHeight }}
      >
        <CodeBlockContent result={result} language={language} />
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
