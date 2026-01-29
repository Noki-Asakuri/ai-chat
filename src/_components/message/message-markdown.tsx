import "katex/dist/katex.min.css";

import { createMathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { Streamdown } from "streamdown";

import { CodeBlock } from "@/components/ui/code-block";

import type { ChatMessage } from "@/lib/types";

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

export function StreamDownWrapper({ children, role, ...props }: MarkdownProps) {
  return (
    <Streamdown
      plugins={{ math, mermaid }}
      mode={role === "assistant" ? "streaming" : "static"}
      components={{ code: CodeBlock }}
      {...props}
    >
      {escapeInvalidMath(children)}
    </Streamdown>
  );
}

StreamDownWrapper.displayName = "StreamDownWrapper";
