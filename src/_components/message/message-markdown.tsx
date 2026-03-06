import "katex/dist/katex.min.css";

import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";

import { memo, useMemo } from "react";
import { bundledLanguages } from "shiki";
import { Streamdown } from "streamdown";

import { CodeBlock } from "@/components/ui/code-block";

import type { ChatMessage } from "@/lib/types";

const NORMALIZED_INLINE_MATH_TOKEN = "__AICHAT_INLINE_MATH_52C527F2__";
const NORMALIZED_BLOCK_MATH_TOKEN = "__AICHAT_BLOCK_MATH_52C527F2__";

function normalizeLatexMathDelimiters(text: string): string {
  const len: number = text.length;
  let out = "";
  let i = 0;
  let inFence = false;
  let inInline = false;

  function isEscaped(index: number): boolean {
    let backslashes = 0;
    let j = index - 1;

    while (j >= 0 && text[j] === "\\") {
      backslashes++;
      j--;
    }

    return backslashes % 2 === 1;
  }

  while (i < len) {
    if (!inInline && text.startsWith("```", i) && !isEscaped(i)) {
      inFence = !inFence;
      out += "```";
      i += 3;
      continue;
    }

    if (!inFence && text[i] === "`" && !isEscaped(i)) {
      inInline = !inInline;
      out += "`";
      i += 1;
      continue;
    }

    if (!inFence && !inInline && text[i] === "\\" && !isEscaped(i)) {
      const open = text[i + 1];
      const isInlineOpen = open === "(";
      const isDisplayOpen = open === "[";

      if (isInlineOpen || isDisplayOpen) {
        const close = isInlineOpen ? ")" : "]";
        const delimiterToken = isInlineOpen
          ? NORMALIZED_INLINE_MATH_TOKEN
          : NORMALIZED_BLOCK_MATH_TOKEN;
        let j = i + 2;
        let found = -1;

        while (j < len - 1) {
          if (text[j] === "\\" && text[j + 1] === close && !isEscaped(j)) {
            found = j;
            break;
          }

          if (text.startsWith("```", j) && !isEscaped(j)) {
            break;
          }

          if (text[j] === "`" && !isEscaped(j)) {
            break;
          }

          j++;
        }

        if (found !== -1) {
          const content = text.slice(i + 2, found);
          out += delimiterToken + content + delimiterToken;
          i = found + 2;
          continue;
        }
      }
    }

    out += text[i]!;
    i += 1;
  }

  return out;
}

function restoreNormalizedMathDelimiters(text: string): string {
  return text
    .replaceAll(NORMALIZED_BLOCK_MATH_TOKEN, "$$")
    .replaceAll(NORMALIZED_INLINE_MATH_TOKEN, "$");
}

function escapeInvalidMath(text: string): string {
  const len: number = text.length;
  let out = "";
  let i = 0;
  let inFence = false;
  let inInline = false;

  function isEscaped(index: number): boolean {
    let backslashes = 0;
    let j = index - 1;

    while (j >= 0 && text[j] === "\\") {
      backslashes++;
      j--;
    }
    return backslashes % 2 === 1;
  }

  function isInvalidInline(content: string): boolean {
    if (content.length === 0) return true;

    const first = content[0]!;
    const last = content[content.length - 1]!;

    if (first === " " || last === " ") return true;
    if (/\d/.test(first)) return true;
    if (content.includes("\n")) return true;
    return false;
  }

  function isInvalidDisplay(content: string): boolean {
    if (content.length === 0) return true;

    const first = content[0]!;
    const last = content[content.length - 1]!;

    if (first === " " || last === " ") return true;
    if (/^\d[\s\S]*$/.test(content)) return true;
    return false;
  }

  while (i < len) {
    if (!inInline && text.startsWith("```", i) && !isEscaped(i)) {
      inFence = !inFence;
      out += "```";
      i += 3;
      continue;
    }

    if (!inFence && text[i] === "`" && !isEscaped(i)) {
      inInline = !inInline;
      out += "`";
      i += 1;
      continue;
    }

    if (!inFence && !inInline && text[i] === "$" && !isEscaped(i)) {
      let run = 1;

      while (i + run < len && text[i + run] === "$") run++;
      if (run > 2) {
        out += text.slice(i, i + run);
        i += run;
        continue;
      }

      const isDisplay = run === 2;
      let j = i + run;
      let found = -1;

      while (j < len) {
        if (text[j] === "$" && !isEscaped(j)) {
          let crun = 1;
          while (j + crun < len && text[j + crun] === "$") crun++;
          if (crun === run) {
            found = j;
            break;
          }
          j += crun;
          continue;
        }
        if (!inInline && text.startsWith("```", j) && !isEscaped(j)) {
          break;
        }
        if (text[j] === "`" && !isEscaped(j)) {
          break;
        }
        j++;
      }

      if (found !== -1) {
        const content = text.slice(i + run, found);
        const invalid = isDisplay ? isInvalidDisplay(content) : isInvalidInline(content);

        if (invalid) {
          out += "\\" + "$".repeat(run) + content + "\\" + "$".repeat(run);
        } else {
          out += text.slice(i, found + run);
        }

        i = found + run;
        continue;
      } else {
        out += text.slice(i, i + run);
        i += run;
        continue;
      }
    }

    out += text[i]!;
    i += 1;
  }

  return out;
}

type MarkdownProps = React.ComponentProps<typeof Streamdown> & {
  role: ChatMessage["role"];
  children: string;
};

const mermaid = createMermaidPlugin();
const math = createMathPlugin({ singleDollarTextMath: true, errorColor: "var(--destructive)" });

const supportedLanguages = Object.keys(bundledLanguages).filter(
  (language) => !["mermaid"].includes(language),
);

export const StreamDownWrapper = memo(function StreamDownWrapper({
  role,
  children,
  isAnimating,
  ...props
}: MarkdownProps) {
  const escapedMarkdown = useMemo(() => {
    const normalizedLatexMarkdown = normalizeLatexMathDelimiters(children);
    const markdownWithEscapedInvalidMath = escapeInvalidMath(normalizedLatexMarkdown);
    return restoreNormalizedMathDelimiters(markdownWithEscapedInvalidMath);
  }, [children]);

  return (
    <Streamdown
      caret="block"
      isAnimating={isAnimating}
      plugins={{
        math,
        mermaid,
        renderers: [{ component: CodeBlock, language: supportedLanguages }],
      }}
      animated={role === "assistant"}
      mode={role === "assistant" && isAnimating === true ? "streaming" : "static"}
      mermaid={{ config: { theme: "dark" } }}
      {...props}
    >
      {escapedMarkdown}
    </Streamdown>
  );
});

StreamDownWrapper.displayName = "StreamDownWrapper";
