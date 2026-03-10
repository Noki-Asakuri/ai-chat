import "katex/dist/katex.min.css";

import { cjk } from "@streamdown/cjk";
import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";

import remarkBreaks from "remark-breaks";

import { memo, useMemo } from "react";
import { bundledLanguages } from "shiki";
import { defaultRemarkPlugins, Streamdown, type StreamdownProps } from "streamdown";

import { CodeBlock } from "@/components/ui/code-block";

import { ExternalLinkSafetyModal } from "./external-link-safety-modal";

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

function escapeInvalidMath(text: string): string {
  const len = text.length;
  const out: string[] = [];
  let i = 0;
  let inFence = false;
  let inInline = false;
  let backslashRun = 0;

  function isDigit(ch: string): boolean {
    const code = ch.charCodeAt(0);
    return code >= 48 && code <= 57;
  }

  function isInvalidInlineRange(start: number, end: number): boolean {
    if (start >= end) return true;

    const first = text[start]!;
    const last = text[end - 1]!;

    if (first === " " || last === " ") return true;
    if (isDigit(first)) return true;

    for (let k = start; k < end; k++) {
      if (text[k] === "\n") return true;
    }

    return false;
  }

  function isInvalidDisplayRange(start: number, end: number): boolean {
    if (start >= end) return true;

    const first = text[start]!;
    const last = text[end - 1]!;

    if (first === " " || last === " ") return true;
    if (isDigit(first)) return true;

    return false;
  }

  function findClosingDollar(start: number, run: number): number {
    let j = start + run;
    let localBackslashRun = 0;

    while (j < len) {
      const ch = text[j]!;
      const escaped = (localBackslashRun & 1) === 1;

      if (!escaped) {
        if (ch === "`") {
          return -1;
        }

        if (ch === "$") {
          let currentRun = 1;

          while (j + currentRun < len && text[j + currentRun] === "$") {
            currentRun++;
          }

          if (currentRun === run) {
            return j;
          }

          j += currentRun;
          localBackslashRun = 0;
          continue;
        }
      }

      if (ch === "\\") {
        localBackslashRun++;
      } else {
        localBackslashRun = 0;
      }

      j++;
    }

    return -1;
  }

  while (i < len) {
    const ch = text[i]!;
    const escaped = (backslashRun & 1) === 1;

    if (!inInline && !escaped && ch === "`" && text[i + 1] === "`" && text[i + 2] === "`") {
      inFence = !inFence;
      out.push("```");
      i += 3;
      backslashRun = 0;
      continue;
    }

    if (!inFence && !escaped && ch === "`") {
      inInline = !inInline;
      out.push("`");
      i += 1;
      backslashRun = 0;
      continue;
    }

    // oxlint-disable-next-line no-useless-escape
    if (!inFence && !inInline && !escaped && ch === "\$") {
      let run = 1;

      // oxlint-disable-next-line no-useless-escape
      while (i + run < len && text[i + run] === "\$") {
        run++;
      }

      if (run > 2) {
        out.push(text.slice(i, i + run));
        i += run;
        backslashRun = 0;
        continue;
      }

      const closing = findClosingDollar(i, run);

      if (closing !== -1) {
        const contentStart = i + run;
        const contentEnd = closing;
        const invalid =
          run === 2
            ? isInvalidDisplayRange(contentStart, contentEnd)
            : isInvalidInlineRange(contentStart, contentEnd);

        if (invalid) {
          const delimiter = run === 1 ? "$" : "$$";
          out.push("\\", delimiter);
          out.push(text.slice(contentStart, contentEnd));
          out.push("\\", delimiter);
        } else {
          out.push(text.slice(i, closing + run));
        }

        i = closing + run;
        backslashRun = 0;
        continue;
      }

      out.push(text.slice(i, i + run));
      i += run;
      backslashRun = 0;
      continue;
    }

    out.push(ch);
    i++;

    if (ch === "\\") {
      backslashRun++;
    } else {
      backslashRun = 0;
    }
  }

  return out.join("");
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
    const normalized = normalizeMissingFenceLanguages(children);
    return escapeInvalidMath(normalized);
  }, [children]);

  const streamdownProps: StreamdownProps = {
    caret: "block",
    isAnimating,
    plugins: {
      cjk,
      math,
      mermaid,
      renderers: [{ component: CodeBlock, language: supportedLanguages }],
    },
    animated: role === "assistant",
    mode: role === "assistant" && isAnimating === true ? "streaming" : "static",
    mermaid: { config: { theme: "dark" } },
    linkSafety: {
      enabled: true,
      renderModal: (modalProps) => <ExternalLinkSafetyModal {...modalProps} />,
    },
    remarkPlugins: [...Object.values(defaultRemarkPlugins), remarkBreaks],
    ...props,
  };

  return <Streamdown {...streamdownProps}>{normalizedChildren}</Streamdown>;
});

StreamDownWrapper.displayName = "StreamDownWrapper";
