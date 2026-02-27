import { code as codePlugin, type HighlightResult } from "@streamdown/code";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BundledLanguage } from "shiki";

import { Icons } from "../icons";

import { CodeBlockBody } from "./body";
import { CodeBlockContainer } from "./container";
import { CodeBlockProvider } from "./context";
import { CodeBlockHeader } from "./header";
import { InlineCodeBlock } from "./inline-codeblock";

type LanguageData = {
  name: string;
  icon?: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
};

const TRAILING_NEWLINES_REGEX = /\n+$/;

export const LINE_CLAMP = 15;
export const LANGUAGE_DISPLAY_NAME: Record<string, LanguageData> = {
  ts: { name: "TypeScript", icon: Icons.typescript },
  typescript: { name: "TypeScript", icon: Icons.typescript },
  tsx: { name: "Typescript React", icon: Icons.tsx },
  jsx: { name: "JavaScript React", icon: Icons.jsx },
  js: { name: "JavaScript", icon: Icons.javascript },
  javascript: { name: "JavaScript", icon: Icons.javascript },
  cpp: { name: "C++", icon: Icons.cpp },
  cs: { name: "C#", icon: Icons.csharp },
  csharp: { name: "C#", icon: Icons.csharp },
  py: { name: "Python", icon: Icons.python },
  python: { name: "Python", icon: Icons.python },
  kt: { name: "Kotlin", icon: Icons.kotlin },
  kotlin: { name: "Kotlin", icon: Icons.kotlin },
  rs: { name: "Rust", icon: Icons.rust },
  rust: { name: "Rust", icon: Icons.rust },
  php: { name: "PHP", icon: Icons.php },
  rb: { name: "Ruby", icon: Icons.ruby },
  ruby: { name: "Ruby", icon: Icons.ruby },
  md: { name: "Markdown", icon: Icons.markdown },
  markdown: { name: "Markdown", icon: Icons.markdown },
  css: { name: "CSS", icon: Icons.css },
  html: { name: "HTML", icon: Icons.html },
  sql: { name: "SQL" },
  sh: { name: "Shell" },
};

export function CodeBlock({ className, children }: React.ComponentProps<"code">) {
  const code = String(children).replace(TRAILING_NEWLINES_REGEX, "");

  const isInline = !code.includes("\n");
  const language = /language-(\w+)/.exec(className ?? "")?.[1] ?? "plaintext";

  if (isInline) return <InlineCodeBlock language={language} code={code} />;
  return <HighlightedCodeBlock language={language} code={code} />;
}

type HighlightedCodeBlockProps = {
  language: string;
  code: string;
};

function HighlightedCodeBlock({ language, code }: HighlightedCodeBlockProps) {
  const totalLines = code.split("\n").length;
  const prevCodeRef = useRef(code);

  const raw: HighlightResult = useMemo(
    () => ({
      bg: "transparent",
      fg: "inherit",
      tokens: code
        .split("\n")
        .map((line) => [
          { content: line, color: "inherit", bgColor: "transparent", htmlStyle: {}, offset: 0 },
        ]),
    }),
    [code],
  );

  const [result, setResult] = useState<HighlightResult>(raw);

  useEffect(() => {
    const isIncrementalUpdate =
      code.startsWith(prevCodeRef.current) && code.length > prevCodeRef.current.length;
    prevCodeRef.current = code;

    const cachedResult = codePlugin.highlight(
      { code, language: language as BundledLanguage, themes: ["one-dark-pro", "one-dark-pro"] },
      (highlightedResult) => {
        prevCodeRef.current = code;
        setResult(highlightedResult);
      },
    );

    if (cachedResult) {
      setResult(cachedResult);
      return;
    }

    if (!isIncrementalUpdate) {
      setResult(raw);
    }
  }, [code, language, raw]);

  return (
    <CodeBlockProvider code={code} language={language} totalLines={totalLines}>
      <CodeBlockContainer>
        <CodeBlockHeader />
        <CodeBlockBody result={result} />
      </CodeBlockContainer>
    </CodeBlockProvider>
  );
}
