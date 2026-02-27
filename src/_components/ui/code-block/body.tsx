import type { HighlightResult } from "@streamdown/code";
import { type ComponentProps, memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { LINE_CLAMP } from ".";
import { useCodeBlockContext } from "./context";
import { EllipsisIcon } from "lucide-react";

type CodeBlockBodyProps = ComponentProps<"pre"> & {
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
 * The body of the code block. This component is memoized to prevent unnecessary re-renders.
 * The code originates from the `@streamdown` package
 *
 * @see https://github.com/vercel/streamdown/blob/main/packages/streamdown/lib/code-block/body.tsx
 */
export const CodeBlockContent = memo(
  ({ children: _code, result, language, className, ...rest }: CodeBlockBodyProps) => {
    // Memoize the pre style object
    const preStyle = useMemo(
      () => ({ backgroundColor: result.bg, color: result.fg }),
      [result.bg, result.fg],
    );

    return (
      <pre
        className={cn(className, "text-sm dark:bg-(--shiki-dark-bg)!")}
        data-language={language}
        data-slot="code-block-body"
        style={preStyle}
        {...rest}
      >
        <code className="[counter-increment:line_0] [counter-reset:line]">
          {result.tokens.map((row, index) => (
            <span className={LINE_NUMBER_CLASSES} key={index}>
              {row.map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  className="dark:bg-(--shiki-dark-bg)! dark:text-(--shiki-dark)!"
                  style={{
                    color: token.color,
                    backgroundColor: token.bgColor,
                    ...token.htmlStyle,
                  }}
                  {...token.htmlAttrs}
                >
                  {token.content}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
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
    <div
      className={cn(
        "relative px-3 py-2",
        isCollapsed ? "custom-scroll overflow-auto" : "overflow-hidden",
      )}
      style={{ maxHeight: containerMaxHeight }}
    >
      <CodeBlockContent result={result} language={language} />

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
