"use client";

import { EllipsisIcon, ExpandIcon, ShrinkIcon, TextIcon, WrapTextIcon } from "lucide-react";
import { useShikiHighlighter } from "react-shiki";

import { CopyButton } from "../copy-button";

import { ButtonWithTip } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

import { cn } from "@/lib/utils";

export type CodeBlockHeaderProps = {
  language?: string;
  showExpand: boolean;
  isExpanded: boolean;
  onExpand: () => void;
  wrapline: boolean;
  onToggleWrapline: () => void;
  code: string;
};

export function CodeBlockHeader({
  language,
  showExpand,
  isExpanded,
  onExpand,
  wrapline,
  onToggleWrapline,
  code,
}: CodeBlockHeaderProps) {
  return (
    <div className="bg-muted/70 flex w-full items-center justify-between gap-2 rounded-md border-b px-2 py-1.5 backdrop-blur-md transition-[border-color] duration-300">
      {showExpand ? (
        <ButtonWithTip
          size="icon"
          title="Open Full Code"
          className="hover:bg-accent/50 pointer-events-auto flex items-center gap-2 bg-transparent text-white"
          onMouseDown={onExpand}
        >
          {isExpanded ? <ShrinkIcon className="size-5" /> : <ExpandIcon className="size-5" />}
        </ButtonWithTip>
      ) : (
        <span className="size-10" />
      )}

      <span className="font-semibold select-none">{language}</span>

      <div className="space-x-2">
        <ButtonWithTip
          title="Wrap Line"
          side="top"
          size="icon"
          variant="ghost"
          onMouseDown={onToggleWrapline}
        >
          {wrapline ? <TextIcon className="size-5" /> : <WrapTextIcon className="size-5" />}
        </ButtonWithTip>

        <CopyButton content={code} />
      </div>
    </div>
  );
}

export type CodeInlinePaneProps = {
  wrapline: boolean;
  totalLines: number;
  previewText: string;
  fullText: string;
  langKey?: string;
};

export function CodeInlinePane({
  wrapline,
  totalLines,
  previewText,
  fullText,
  langKey,
}: CodeInlinePaneProps) {
  const showFullInline = totalLines <= 10;

  const highlighted = useShikiHighlighter(
    showFullInline ? fullText : previewText,
    langKey,
    "one-dark-pro",
    { delay: 50 },
  );

  return (
    <div
      style={{ scrollbarGutter: "stable both-edges" }}
      className={cn(
        "custom-scroll codeblock w-full overflow-x-auto bg-[#282c34] p-3 font-mono text-sm *:!bg-transparent",
        { "*:text-wrap *:wrap-anywhere": wrapline },
      )}
    >
      {highlighted ?? <pre>{showFullInline ? fullText : previewText}</pre>}
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
  const highlightedFull = useShikiHighlighter(normalizedFull, langKey, "one-dark-pro", {
    delay: 50,
    showLineNumbers: true,
  });

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

          <div className="bg-muted/70 flex w-full items-center justify-between gap-2 border-b px-3 py-2">
            <span className="font-semibold select-none">{language}</span>
            <div className="space-x-2">
              <ButtonWithTip
                title="Wrap Line"
                side="top"
                variant="ghost"
                size="icon"
                onMouseDown={onToggleWrapline}
              >
                {wrapline ? <TextIcon className="size-5" /> : <WrapTextIcon className="size-5" />}
              </ButtonWithTip>

              <CopyButton content={code} />

              <ButtonWithTip
                title="Close"
                side="top"
                variant="ghost"
                size="icon"
                onMouseDown={() => onOpenChange(false)}
              >
                <ShrinkIcon className="size-5" />
              </ButtonWithTip>
            </div>
          </div>

          <div
            style={{ scrollbarGutter: "stable both-edges" }}
            className={cn(
              "custom-scroll codeblock flex-1 overflow-auto bg-[#282c34] p-3 font-mono text-sm *:!bg-transparent",
              { "*:text-wrap *:wrap-anywhere": wrapline },
            )}
          >
            {highlightedFull ?? <pre>{normalizedFull}</pre>}
          </div>
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

        <div className="bg-muted/70 flex w-full items-center justify-between gap-2 border-b px-3 py-2">
          <span className="font-semibold select-none">{language}</span>
          <div className="space-x-2">
            <ButtonWithTip
              title="Wrap Line"
              side="top"
              variant="ghost"
              size="icon"
              onMouseDown={onToggleWrapline}
            >
              {wrapline ? <TextIcon className="size-5" /> : <WrapTextIcon className="size-5" />}
            </ButtonWithTip>
            <CopyButton content={code} />
            <ButtonWithTip
              title="Close"
              side="top"
              variant="ghost"
              size="icon"
              onMouseDown={() => onOpenChange(false)}
            >
              <ShrinkIcon className="size-5" />
            </ButtonWithTip>
          </div>
        </div>

        <div
          style={{ scrollbarGutter: "stable both-edges" }}
          className={cn(
            "custom-scroll codeblock h-[calc(100vh-48px)] overflow-auto bg-[#282c34] p-3 font-mono text-sm *:!bg-transparent",
            { "*:text-wrap *:wrap-anywhere": wrapline },
          )}
        >
          {highlightedFull ?? <pre>{normalizedFull}</pre>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
