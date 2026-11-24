import type { TokensResult as HighlightResult } from "@pierre/highlights";
import { useContext, useEffect, useMemo, useState } from "react";
import { StreamdownContext, type CustomRendererProps } from "streamdown";

import { extractOriginalFenceLanguage } from "@/components/message/utils/normalize-code-fence-languages";

import { Icons } from "../icons";

import { CodeBlockBody } from "./body";
import { CodeBlockContainer } from "./container";
import { CodeBlockProvider } from "./context";
import { CodeBlockHeader } from "./header";
import { IncrementalTokenizer } from "./incremental-tokenizer";

type LanguageData = {
  name: string;
  icon?: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
};

const TRAILING_NEWLINES_REGEX = /\n+$/;

export const LINE_CLAMP = 15;
export const LANGUAGE_DISPLAY_NAME = {
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
} satisfies Record<string, LanguageData>;

export function getLanguageData(language: string): LanguageData | undefined {
  for (const [languageKey, languageData] of Object.entries(LANGUAGE_DISPLAY_NAME)) {
    if (languageKey === language) return languageData;
  }
  return undefined;
}

type CodeBlockProps = CustomRendererProps & {
  showButtonActions?: boolean;
  highlightedResult?: HighlightResult;
};

export function CodeBlock({
  code: rawCode,
  isIncomplete,
  language,
  meta,
  showButtonActions = true,
  highlightedResult,
}: CodeBlockProps) {
  const { isAnimating } = useContext(StreamdownContext);
  const code = rawCode.replace(TRAILING_NEWLINES_REGEX, "");
  const displayLanguage = extractOriginalFenceLanguage(meta) ?? language;

  if (highlightedResult) {
    return (
      <RenderedCodeBlock
        code={code}
        displayLanguage={displayLanguage}
        result={highlightedResult}
        showButtonActions={showButtonActions}
      />
    );
  }

  return (
    <HighlightedCodeBlock
      language={displayLanguage}
      displayLanguage={displayLanguage}
      code={code}
      streaming={isAnimating && isIncomplete}
      showButtonActions={showButtonActions}
    />
  );
}

type HighlightedCodeBlockProps = {
  language: string;
  displayLanguage: string;
  code: string;
  streaming: boolean;
  showButtonActions: boolean;
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

async function loadHighlighter() {
  const [highlighter, { default: githubLight }, { default: oneDarkPro }] = await Promise.all([
    import("@pierre/highlights"),
    import("@pierre/highlights/themes/github-light"),
    import("@pierre/highlights/themes/one-dark-pro"),
  ]);

  return { ...highlighter, githubLight, oneDarkPro };
}

function HighlightedCodeBlock({
  language,
  displayLanguage,
  code,
  streaming,
  showButtonActions,
}: HighlightedCodeBlockProps) {
  const [highlighter, setHighlighter] = useState<Awaited<ReturnType<typeof loadHighlighter>> | null>(null);
  const [incremental] = useState(() => new IncrementalTokenizer());

  useEffect(() => () => incremental.dispose(), [incremental]);

  useEffect(() => {
    let cancelled = false;

    loadHighlighter()
      .then((loadedHighlighter) => {
        if (cancelled) return undefined;

        return setHighlighter(loadedHighlighter);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to highlight code:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => {
    if (!highlighter) return splitCodeToHighlightTokens(code);

    const lang = language.trim().toLowerCase();
    const options = {
      lang: highlighter.isSupportedLanguage(lang) ? lang : "text",
      // The light theme colors tokens inline; `dark:` classes in the body swap in --shiki-dark.
      themes: { light: highlighter.githubLight, dark: highlighter.oneDarkPro },
      cssVariablePrefix: "--shiki-",
    };

    // Re-tokenizing the whole fence on every streamed chunk is quadratic, so stream only the delta.
    if (streaming) {
      return transformHighlightResult({
        ...highlighter.codeToTokens("", options),
        bg: "transparent",
        tokens: incremental.tokenize(code, options.lang, () => new highlighter.StreamTokenizer(options)),
      });
    }

    incremental.dispose();
    return transformHighlightResult({ ...highlighter.codeToTokens(code, options), bg: "transparent" });
  }, [code, language, highlighter, streaming, incremental]);

  return (
    <RenderedCodeBlock
      code={code}
      displayLanguage={displayLanguage}
      result={result}
      showButtonActions={showButtonActions}
    />
  );
}

type RenderedCodeBlockProps = {
  code: string;
  displayLanguage: string;
  result: HighlightResult;
  showButtonActions: boolean;
};

function RenderedCodeBlock({ code, displayLanguage, result, showButtonActions }: RenderedCodeBlockProps) {
  return (
    <CodeBlockProvider code={code} language={displayLanguage} totalLines={code.split("\n").length}>
      <CodeBlockContainer>
        <CodeBlockHeader showButtonActions={showButtonActions} />
        <CodeBlockBody result={result} />
      </CodeBlockContainer>
    </CodeBlockProvider>
  );
}

export { InlineCodeBlock } from "./inline-code-block";
