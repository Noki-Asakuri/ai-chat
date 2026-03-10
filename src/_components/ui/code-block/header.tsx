import { ExpandIcon, ShrinkIcon, TextIcon, WrapTextIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import { LANGUAGE_DISPLAY_NAME, LINE_CLAMP } from ".";
import { useCodeBlockContext } from "./context";

import { CopyButton } from "@/components/copy-button";
import { ButtonWithTip } from "@/components/ui/button";

import { useChatStore } from "@/lib/store/chat-store";
import { cn } from "@/lib/utils";

export function CodeBlockHeader() {
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const {
    expanded,
    setExpanded,
    wrapline,
    toggleWrapline,
    code,
    language,
    totalLines,
    containerHeightPx,
  } = useCodeBlockContext();

  const languageData = LANGUAGE_DISPLAY_NAME[language];
  const Icon = languageData?.icon;

  const calculateShouldStickyHeader = useCallback(() => {
    if (!expanded) return false;

    const availableViewportPx = window.innerHeight - textareaHeight - 40;
    if (availableViewportPx <= 0) return false;

    return containerHeightPx > availableViewportPx;
  }, [expanded, textareaHeight, containerHeightPx]);

  const shouldStickyHeader = calculateShouldStickyHeader();

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-3 py-1",
        shouldStickyHeader && "sticky top-10 z-30 backdrop-blur-md",
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        {Icon && <Icon className="size-5 rounded-sm" />}

        <span className="capitalize">{languageData?.name ?? language}</span>
        <span className="text-xs text-primary">{totalLines} lines</span>
      </div>

      <div className="pointer-events-auto flex items-center gap-1">
        {totalLines > LINE_CLAMP && (
          <ButtonWithTip
            side="top"
            variant="ghost"
            className="size-8"
            title={expanded ? "Collapse" : "Expand"}
            onMouseDown={() => setExpanded((v) => !v)}
          >
            {expanded ? <ShrinkIcon className="size-4" /> : <ExpandIcon className="size-4" />}
          </ButtonWithTip>
        )}

        <ButtonWithTip
          title="Wrap"
          side="top"
          variant="ghost"
          className="size-8"
          onMouseDown={toggleWrapline}
        >
          {wrapline ? <TextIcon className="size-4" /> : <WrapTextIcon className="size-4" />}
        </ButtonWithTip>

        <CopyButton content={code} className="size-8" />
      </div>
    </div>
  );
}
