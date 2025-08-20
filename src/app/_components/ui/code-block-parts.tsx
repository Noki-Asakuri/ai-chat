"use client";

import { transformerColorizedBrackets } from "@shikijs/colorized-brackets";
import { EllipsisIcon, ShrinkIcon, TextIcon, WrapTextIcon } from "lucide-react";
import { Fragment } from "react";
import { useShikiHighlighter } from "react-shiki";

import { CopyButton } from "../copy-button";

import { ButtonWithTip } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

import { cn } from "@/lib/utils";

export type CodeBlockHeaderProps = {
  code: string;
};

export function CodeBlockHeader({ code }: CodeBlockHeaderProps) {
  return (
    <div className="absolute top-2 right-2">
      <CopyButton content={code} className="size-8" />
    </div>
  );
}

export type CodeInlinePaneProps = {
  wrapline: boolean;
  code: string;
  langKey?: string;
};

export function CodeInlinePane({ wrapline, code, langKey }: CodeInlinePaneProps) {
  const highlighted = useShikiHighlighter(code, langKey, "one-dark-pro", { delay: 50 });

  return (
    <div
      style={{ scrollbarGutter: "stable both-edges" }}
      className={cn(
        "custom-scroll codeblock w-full overflow-x-auto bg-[#282c34] p-3 pr-10 font-mono text-sm *:!bg-transparent",
        { "*:text-wrap *:wrap-anywhere": wrapline },
      )}
    >
      {highlighted ?? <pre>{code}</pre>}
    </div>
  );
}

export type ExpandFooterProps = {
  totalLines: number;
  onExpand: () => void;
};

export function ExpandFooter({ totalLines, onExpand }: ExpandFooterProps) {
  if (totalLines <= 10) return null;
  return (
    <div className="bg-muted/50 text-muted-foreground flex items-center border-t p-2">
      <button
        type="button"
        className="hover:text-foreground flex items-center gap-2 underline"
        onMouseDown={onExpand}
      >
        <EllipsisIcon className="size-4" /> See all {totalLines} lines
      </button>
    </div>
  );
}

export type FullCodeOverlayProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isMobile: boolean;
  language?: string;
  wrapline: boolean;
  onToggleWrapline: () => void;
  code: string;
  normalizedFull: string;
  langKey?: string;
};

export function FullCodeOverlay({
  open,
  onOpenChange,
  isMobile,
  language,
  wrapline,
  onToggleWrapline,
  code,
  normalizedFull,
  langKey,
}: FullCodeOverlayProps) {
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[95vh] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 p-2"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Full code {language}</DialogTitle>
          <DialogDescription className="sr-only">
            Full source code block preview and copy actions
          </DialogDescription>

          <CodeBlockRender
            language={language}
            wrapline={wrapline}
            onToggleWrapline={onToggleWrapline}
            code={code}
            normalizedFull={normalizedFull}
            langKey={langKey}
            onOpenChange={onOpenChange}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[720px]"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Full code {language}</SheetTitle>
        <SheetDescription className="sr-only">
          Full source code block preview and copy actions
        </SheetDescription>

        <CodeBlockRender
          language={language}
          wrapline={wrapline}
          onToggleWrapline={onToggleWrapline}
          code={code}
          normalizedFull={normalizedFull}
          langKey={langKey}
          onOpenChange={onOpenChange}
        />
      </SheetContent>
    </Sheet>
  );
}

type CodeBlockRenderProps = {
  language?: string;
  wrapline: boolean;
  onToggleWrapline: () => void;
  code: string;
  normalizedFull: string;
  langKey?: string;
  onOpenChange: (v: boolean) => void;
};

function CodeBlockRender(props: CodeBlockRenderProps) {
  const highlightedFull = useShikiHighlighter(props.normalizedFull, props.langKey, "one-dark-pro", {
    transformers: [transformerColorizedBrackets()],
  });

  return (
    <Fragment>
      <div className="bg-muted/70 flex w-full items-center justify-between gap-2 border-b px-3 py-2">
        <span className="font-semibold capitalize">{props.language}</span>

        <div className="space-x-2">
          <ButtonWithTip
            title="Wrap Line"
            side="top"
            variant="ghost"
            className="size-8"
            onMouseDown={props.onToggleWrapline}
          >
            {props.wrapline ? <TextIcon className="size-4" /> : <WrapTextIcon className="size-4" />}
          </ButtonWithTip>

          <CopyButton content={props.code} className="size-8" />

          <ButtonWithTip
            title="Close"
            side="top"
            variant="ghost"
            className="size-8"
            onMouseDown={() => props.onOpenChange(false)}
          >
            <ShrinkIcon className="size-4" />
          </ButtonWithTip>
        </div>
      </div>

      <div
        data-slot="codeblock"
        data-should-wrap={props.wrapline}
        className="custom-scroll codeblock overflow-auto font-mono text-sm"
      >
        {highlightedFull ?? <pre>{props.normalizedFull}</pre>}
      </div>
    </Fragment>
  );
}
