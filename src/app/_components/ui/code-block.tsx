import { ChevronUpIcon, TextIcon, WrapTextIcon } from "lucide-react";

import { Collapsible } from "@base-ui-components/react/collapsible";
import { useShikiHighlighter } from "react-shiki";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "./button";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

type CodeBlockProps = React.ComponentProps<"div"> & {
  code: string;
  language?: string;
  theme?: string;
};

export function ShikiCodeBlock({ language, code }: CodeBlockProps) {
  const wrapline = useChatStore((state) => state.wrapline);
  const toggleWrapline = useChatStore((state) => state.toggleWrapline);

  const highlightedCode = useShikiHighlighter(
    code,
    language === "assembly" ? "asm" : language,
    "one-dark-pro",
    { delay: 50 },
  );

  return (
    <Collapsible.Root defaultOpen className="group/code-block overflow-hidden rounded-md border">
      <div className="bg-muted/70 flex w-full items-center justify-between gap-2 rounded-md border-b px-2 py-1.5 backdrop-blur-md transition-[border-color] duration-300 group-data-[closed]/code-block:border-transparent">
        <Collapsible.Trigger
          render={ButtonWithTip}
          title="Collapse Code Block"
          className="hover:bg-accent/50 pointer-events-auto flex items-center gap-2 bg-transparent text-white"
        >
          <ChevronUpIcon className="size-5 transition-transform group-data-[closed]/code-block:rotate-180" />
        </Collapsible.Trigger>

        <span className="font-semibold select-none">{language}</span>

        <div className="space-x-2">
          <ButtonWithTip title="Wrap Line" side="top" variant="ghost" onMouseDown={toggleWrapline}>
            {wrapline ? <TextIcon className="size-5" /> : <WrapTextIcon className="size-5" />}
          </ButtonWithTip>

          <CopyButton content={code} />
        </div>
      </div>

      <Collapsible.Panel className="flex h-[var(--collapsible-panel-height)] flex-col justify-end overflow-hidden text-sm transition-all ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        <div
          style={{ scrollbarGutter: "stable both-edges" }}
          className={cn(
            "custom-scroll w-full overflow-x-auto bg-[#282c34] p-3 font-mono text-sm *:!bg-transparent",
            { "*:text-wrap *:wrap-anywhere": wrapline },
          )}
        >
          {highlightedCode ?? <pre>{code}</pre>}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
