import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";

import { isInlineCode, type Element } from "react-shiki";

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { cn } from "@/lib/utils";

import { ShikiCodeBlock } from "./ui/code-block";
import {
  TypographyBlockquote,
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyInlineCode,
  TypographyOrderedList,
  TypographyP,
  TypographySmall,
  TypographyTable,
  TypographyTableTD,
  TypographyTableTH,
  TypographyTableTHead,
  TypographyTableTR,
  TypographyUnorderedList,
} from "./ui/typography";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
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
  ({ content }: { content: string }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
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
        code: CodeBlock,
      }}
    >
      {content}
    </ReactMarkdown>
  ),
  (prevProps, nextProps) => {
    if (prevProps.content !== nextProps.content) return false;
    return true;
  },
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(({ content, id }: { content: string; id: string }) => {
  const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
  return blocks.map((block, index) => (
    <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
  ));
});

MemoizedMarkdown.displayName = "MemoizedMarkdown";
