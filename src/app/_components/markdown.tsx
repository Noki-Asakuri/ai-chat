import { marked } from "marked";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

import {
  TypographyP,
  TypographyBlockquote,
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyInlineCode,
  TypographyList,
  TypographySmall,
  TypographyTable,
  TypographyTableTHead,
  TypographyTableTH,
  TypographyTableTR,
  TypographyTableTD,
} from "./ui/typography";
import { ShikiCodeBlock } from "./ui/code-block";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

type Props = React.ClassAttributes<HTMLElement> & React.HTMLAttributes<HTMLElement> & ExtraProps;

function CodeBlock({ node: _node, className, children, ...props }: Props & { children: string }) {
  const match = /language-(\w+)/.exec(className ?? "");

  if (!match) {
    return (
      <TypographyInlineCode className={cn("not-prose", className)} {...props}>
        {children}
      </TypographyInlineCode>
    );
  }

  return (
    <ShikiCodeBlock language={match[1]} {...props}>
      {String(children).replace(/\n$/, "")}
    </ShikiCodeBlock>
  );
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: TypographyH1,
        h2: TypographyH2,
        h3: TypographyH3,
        h4: TypographyH4,
        blockquote: TypographyBlockquote,
        p: TypographyP,
        ul: TypographyList,
        small: TypographySmall,
        thead: TypographyTableTHead,
        th: TypographyTableTH,
        tr: TypographyTableTR,
        td: TypographyTableTD,
        table: TypographyTable,
        // @ts-expect-error Incorrect type but working
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
  return blocks.map((block, index) => <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />);
});

MemoizedMarkdown.displayName = "MemoizedMarkdown";
