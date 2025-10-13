import { marked } from "marked";
import { memo, useMemo } from "react";

import { isInlineCode, type Element } from "react-shiki";
import { Streamdown } from "streamdown";

import { harden as rehypeHarden } from "rehype-harden";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { ShikiCodeBlock } from "../ui/code-block";
import { TypographyInlineCode } from "../ui/typography";

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

function CodeBlock({
  className,
  children,
  node,
  ...props
}: React.ComponentProps<"code"> & { node?: Element }) {
  const code = String(children as string);
  const isInline = node ? isInlineCode(node) : undefined;
  const language = /language-(\w+)/.exec(className ?? "")?.[1];

  if (isInline) return <TypographyInlineCode className={className} children={code} {...props} />;
  return <ShikiCodeBlock language={language ?? "plaintext"} code={code} />;
}

export const MemoizedMarkdownBlock = memo(
  ({ content, isStreaming }: { content: string; isStreaming?: boolean }) => {
    return (
      <Streamdown
        isAnimating={isStreaming}
        parseIncompleteMarkdown
        rehypePlugins={[
          [
            rehypeHarden,
            {
              allowedLinkPrefixes: ["*"],
              defaultOrigin: "https://*.asakuri.me",
              allowedImagePrefixes: ["https://files.chat.asakuri.me", "https://ik.imagekit.io"],
            },
          ],
          rehypeRaw,
          [rehypeKatex, { errorColor: "var(--color-muted-foreground)" }],
        ]}
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        remarkRehypeOptions={{ allowDangerousHtml: true }}
        children={escapeInvalidMath(content)}
        components={{ code: CodeBlock }}
      />
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content,
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function parseContentToBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

type MarkdownProps = { content: string; id: string; isStreaming?: boolean };

export const MemoizedMarkdown = memo(({ content, id, isStreaming }: MarkdownProps) => {
  const blocks = useMemo(() => parseContentToBlocks(content), [content]);
  return blocks.map((block, index) => {
    if (block.trim().length === 0) return null;
    return (
      <MemoizedMarkdownBlock
        content={block}
        isStreaming={isStreaming}
        key={`${id}-block_${index}`}
      />
    );
  });
});

MemoizedMarkdown.displayName = "MemoizedMarkdown";
