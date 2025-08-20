/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/prefer-regexp-exec */
import "katex/dist/katex.min.css";

import hardenReactMarkdown from "harden-react-markdown";
import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";

import { isInlineCode, type Element } from "react-shiki";

import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

import { ShikiCodeBlock } from "../ui/code-block";
import {
  TypographyBlockquote,
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyInlineCode,
  TypographyP,
  TypographySmall,
  TypographyTable,
  TypographyTableTD,
  TypographyTableTH,
  TypographyTableTHead,
  TypographyTableTR,
  TypographyAnchor,
  TypographyOrderedList,
  TypographyUnorderedList,
} from "../ui/typography";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
function parseIncompleteMarkdown(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let result = text;

  // Handle incomplete links and images
  // Pattern: [...] or ![...] where the closing ] is missing
  const linkImagePattern = /(!?\[)([^\]]*?)$/;
  const linkMatch = result.match(linkImagePattern);
  if (linkMatch) {
    // If we have an unterminated [ or ![, remove it and everything after
    const startIndex = result.lastIndexOf(linkMatch[1]!);
    result = result.substring(0, startIndex);
  }

  // Handle incomplete bold formatting (**)
  const boldPattern = /(\*\*)([^*]*?)$/;
  const boldMatch = result.match(boldPattern);
  if (boldMatch) {
    // Count the number of ** in the entire string
    const asteriskPairs = (result.match(/\*\*/g) || []).length;
    // If odd number of **, we have an incomplete bold - complete it
    if (asteriskPairs % 2 === 1) {
      result = `${result}**`;
    }
  }

  // Handle incomplete italic formatting (__) — ignore underscores inside fenced code blocks (```...```)
  const italicPattern = /(__)([^_]*?)$/;
  const italicMatch = result.match(italicPattern);
  if (italicMatch) {
    const outside = stripFencedCode(result);
    const underscorePairs = (outside.match(/__/g) || []).length;
    if (underscorePairs % 2 === 1) {
      result = `${result}__`;
    }
  }

  // Handle incomplete single asterisk italic (*) — ignore asterisks inside fenced code blocks (```...```)
  function stripFencedCode(input: string): string {
    let out = "";
    let i = 0;

    while (i < input.length) {
      const open = input.indexOf("```", i);
      if (open === -1) {
        out += input.slice(i);
        break;
      }

      // append text before the fence
      out += input.slice(i, open);
      const close = input.indexOf("```", open + 3);
      if (close === -1) {
        // unclosed fence; drop the rest
        break;
      }
      // skip the fenced block
      i = close + 3;
    }
    return out;
  }
  {
    const outside = stripFencedCode(result);
    // Count single asterisks that aren't part of ** in non-code sections only
    const singleAsterisks = outside.split("").reduce((acc, char, index) => {
      if (char === "*") {
        const prevChar = outside[index - 1];
        const nextChar = outside[index + 1];
        if (prevChar !== "*" && nextChar !== "*") {
          return acc + 1;
        }
      }
      return acc;
    }, 0);

    if (singleAsterisks % 2 === 1) {
      result = `${result}*`;
    }
  }

  // Handle incomplete single underscore italic (_) — ignore underscores inside fenced code blocks (```...```)
  const singleUnderscorePattern = /(_)([^_]*?)$/;
  const singleUnderscoreMatch = result.match(singleUnderscorePattern);
  if (singleUnderscoreMatch) {
    const outside = stripFencedCode(result);
    const singleUnderscores = outside.split("").reduce((acc, char, index) => {
      if (char === "_") {
        const prevChar = outside[index - 1];
        const nextChar = outside[index + 1];
        if (prevChar !== "_" && nextChar !== "_") {
          return acc + 1;
        }
      }
      return acc;
    }, 0);

    if (singleUnderscores % 2 === 1) {
      result = `${result}_`;
    }
  }

  // Handle incomplete inline code blocks (`) - but avoid code blocks (```)
  const inlineCodePattern = /(`)([^`]*?)$/;
  const inlineCodeMatch = result.match(inlineCodePattern);
  if (inlineCodeMatch) {
    // Check if we're dealing with a code block (triple backticks)
    const allTripleBackticks = (result.match(/```/g) || []).length;

    // If we have an odd number of ``` sequences, we're inside an incomplete code block
    // In this case, don't complete inline code
    const insideIncompleteCodeBlock = allTripleBackticks % 2 === 1;

    if (!insideIncompleteCodeBlock) {
      // Count the number of single backticks that are NOT part of triple backticks
      let singleBacktickCount = 0;
      for (let i = 0; i < result.length; i++) {
        if (result[i] === "`") {
          // Check if this backtick is part of a triple backtick sequence
          const isTripleStart = result.substring(i, i + 3) === "```";
          const isTripleMiddle = i > 0 && result.substring(i - 1, i + 2) === "```";
          const isTripleEnd = i > 1 && result.substring(i - 2, i + 1) === "```";

          if (!(isTripleStart || isTripleMiddle || isTripleEnd)) {
            singleBacktickCount++;
          }
        }
      }

      // If odd number of single backticks, we have an incomplete inline code - complete it
      if (singleBacktickCount % 2 === 1) {
        result = `${result}\``;
      }
    }
  }

  // Handle incomplete strikethrough formatting (~~)
  const strikethroughPattern = /(~~)([^~]*?)$/;
  const strikethroughMatch = result.match(strikethroughPattern);
  if (strikethroughMatch) {
    // Count the number of ~~ in the entire string
    const tildePairs = (result.match(/~~/g) || []).length;
    // If odd number of ~~, we have an incomplete strikethrough - complete it
    if (tildePairs % 2 === 1) {
      result = `${result}~~`;
    }
  }

  return result;
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

const HardenedMarkdown = hardenReactMarkdown(ReactMarkdown);

function CodeBlock({
  className,
  children,
  node,
  ...props
}: React.ComponentProps<"code"> & { node?: Element }) {
  const code = String(children as string);
  const isInline = node ? isInlineCode(node) : undefined;
  const language = /language-(\w+)/.exec(className ?? "")?.[1];

  if (isInline) {
    return (
      <TypographyInlineCode className={cn("not-prose", className)} {...props}>
        {code}
      </TypographyInlineCode>
    );
  }

  return <ShikiCodeBlock language={language ?? "plaintext"} code={code} />;
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    const parsedContent = escapeInvalidMath(parseIncompleteMarkdown(content));

    return (
      <HardenedMarkdown
        allowedImagePrefixes={["*"]}
        allowedLinkPrefixes={["*"]}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
        components={{
          h1: TypographyH1,
          h2: TypographyH2,
          h3: TypographyH3,
          h4: TypographyH4,
          blockquote: TypographyBlockquote,
          p: TypographyP,
          ul: TypographyUnorderedList,
          ol: TypographyOrderedList,
          small: TypographySmall,
          thead: TypographyTableTHead,
          th: TypographyTableTH,
          tr: TypographyTableTR,
          td: TypographyTableTD,
          table: TypographyTable,
          a: TypographyAnchor,
          code: CodeBlock,
          pre: ({ children }) => children,
        }}
      >
        {parsedContent}
      </HardenedMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content,
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(({ content, id }: { content: string; id: string }) => {
  const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
  return blocks.map((block, index) => (
    <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
  ));
});

MemoizedMarkdown.displayName = "MemoizedMarkdown";
