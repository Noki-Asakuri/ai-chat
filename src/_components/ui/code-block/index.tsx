import { code as codePlugin, type HighlightOptions, type HighlightResult } from "@streamdown/code";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useIsCodeFenceIncomplete, type CustomRendererProps } from "streamdown";

import { Icons } from "../icons";

import { CodeBlockBody } from "./body";
import { CodeBlockContainer } from "./container";
import { CodeBlockProvider } from "./context";
import { CodeBlockHeader } from "./header";

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

export function CodeBlock({ code: rawCode, language }: CustomRendererProps) {
  const code = String(rawCode).replace(TRAILING_NEWLINES_REGEX, "");
  return <HighlightedCodeBlock language={language} code={code} />;
}

type HighlightedCodeBlockProps = {
  language: string;
  code: string;
};

function splitCodeToHighlightTokens(code: string) {
  const result: HighlightResult = {
    bg: "transparent",
    fg: "inherit",
    tokens: [],
  };

  for (const line of code.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "") {
      result.tokens.push([]);
      continue;
    }

    result.tokens.push([
      { content: line, color: "inherit", bgColor: "transparent", htmlStyle: {}, offset: 0 },
    ]);
  }

  return result;
}

function transformHighlightResult(result: HighlightResult) {
  const transformedTokens = result.tokens.slice();
  let hasChanges = false;

  for (let i = 0; i < transformedTokens.length; i++) {
    const line = transformedTokens[i];

    if (line && line.length === 1 && line[0]!.content.trim() === "") {
      transformedTokens[i] = [];
      hasChanges = true;
      continue;
    }
  }

  if (!hasChanges) {
    return result;
  }

  return {
    ...result,
    tokens: transformedTokens,
  };
}

function HighlightedCodeBlock({ language, code }: HighlightedCodeBlockProps) {
  const totalLines = code.split("\n").length;
  const prevCodeRef = useRef(code);

  const isIncomplete = useIsCodeFenceIncomplete();

  const raw: HighlightResult = useMemo(() => splitCodeToHighlightTokens(code), [code]);
  const [result, setResult] = useState<HighlightResult>(raw);

  useEffect(() => {
    if (isIncomplete) return setResult(raw);

    const isIncrementalUpdate =
      code.startsWith(prevCodeRef.current) && code.length > prevCodeRef.current.length;
    prevCodeRef.current = code;

    const cachedResult = codePlugin.highlight(
      {
        code,
        language: language as HighlightOptions["language"],
        themes: ["one-dark-pro", "one-dark-pro"],
      },
      (highlightedResult) => {
        prevCodeRef.current = code;
        startTransition(() => {
          setResult(transformHighlightResult(highlightedResult));
        });
      },
    );

    if (cachedResult) {
      startTransition(() => {
        setResult(transformHighlightResult(cachedResult));
      });
      return;
    }

    if (!isIncrementalUpdate) {
      setResult(raw);
    }
  }, [code, language, raw, isIncomplete]);

  return (
    <CodeBlockProvider code={code} language={language} totalLines={totalLines}>
      <CodeBlockContainer>
        <CodeBlockHeader />
        <CodeBlockBody result={result} />
      </CodeBlockContainer>
    </CodeBlockProvider>
  );
}

export { InlineCodeBlock } from "./inline-codeblock";
