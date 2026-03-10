import "katex/dist/katex.min.css";

import { cjk } from "@streamdown/cjk";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";

import { memo, useMemo } from "react";
import { bundledLanguages } from "shiki";
import { Streamdown } from "streamdown";

import { CodeBlock } from "@/components/ui/code-block";

import type { ChatMessage } from "@/lib/types";

function normalizeMissingFenceLanguages(text: string): string {
  const parts = text.split(/(\r?\n)/);
  let out = "";
  let inFence = false;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i] ?? "";
    const newline = parts[i + 1] ?? "";
    const trimmedLine = line.trimStart();
    const isBareTripleBacktickFence = /^```[ \t]*$/.test(trimmedLine);

    if (!inFence && trimmedLine.startsWith("```")) {
      if (isBareTripleBacktickFence) {
        const leadingWhitespace = line.slice(0, line.length - trimmedLine.length);
        out += leadingWhitespace + "```plaintext" + newline;
      } else {
        out += line + newline;
      }

      inFence = true;
      continue;
    }

    if (inFence && isBareTripleBacktickFence) {
      inFence = false;
    }

    out += line + newline;
  }

  return out;
}

type MarkdownProps = React.ComponentProps<typeof Streamdown> & {
  role: ChatMessage["role"];
  children: string;
};

const mermaid = createMermaidPlugin();
const math = createMathPlugin({ singleDollarTextMath: true, errorColor: "var(--destructive)" });

const supportedLanguages = [
  ...Object.keys(bundledLanguages).filter((language) => !["mermaid"].includes(language)),
  "plaintext",
  "text",
];

export const StreamDownWrapper = memo(function StreamDownWrapper({
  role,
  children,
  isAnimating,
  ...props
}: MarkdownProps) {
  const normalizedChildren = useMemo(() => {
    return normalizeMissingFenceLanguages(children);
  }, [children]);

  return (
    <Streamdown
      caret="block"
      isAnimating={isAnimating}
      plugins={{
        cjk,
        math,
        mermaid,
        renderers: [{ component: CodeBlock, language: supportedLanguages }],
      }}
      animated={role === "assistant"}
      mode={role === "assistant" && isAnimating === true ? "streaming" : "static"}
      mermaid={{ config: { theme: "dark" } }}
      {...props}
    >
      {normalizedChildren}
    </Streamdown>
  );
});

StreamDownWrapper.displayName = "StreamDownWrapper";
