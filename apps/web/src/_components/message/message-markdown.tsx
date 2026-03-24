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
import { addMissingFenceLanguages } from "./utils/add-missing-fence-languages";
import { fixLatexMath } from "./utils/fix-latex-math";

import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  className,
  ...props
}: MarkdownProps) {
  const normalizedChildren = useMemo(() => {
    const fixedFenceLanguages = addMissingFenceLanguages(children);
    const fixedMath = fixLatexMath(fixedFenceLanguages);

    return fixedMath;
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
    className: cn("chat-markdown", className),
    remarkPlugins: [...Object.values(defaultRemarkPlugins), remarkBreaks],
    ...props,
  };

  return <Streamdown {...streamdownProps}>{normalizedChildren}</Streamdown>;
});

StreamDownWrapper.displayName = "StreamDownWrapper";
