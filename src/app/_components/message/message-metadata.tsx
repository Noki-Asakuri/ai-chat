import { ClockIcon, CogIcon, InfoIcon, ZapIcon, SparkleIcon } from "lucide-react";

import { Icons } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getModelData } from "@/lib/chat/models";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";
import { cn, format } from "@/lib/utils";

type MessageMetadataProps = {
  metadata: ChatMessage["metadata"];
  model: string;
  hiddenReasoning: boolean;
};

export function MessageMetadata({ metadata, model, hiddenReasoning }: MessageMetadataProps) {
  const isMobile = useIsMobile();
  if (!metadata) return null;

  const modelData = getModelData(model);
  const tokPerSec =
    metadata.duration > 0 ? (metadata.totalTokens / (metadata.duration / 1000)).toFixed(2) : 0;

  if (isMobile) {
    return (
      <div className="text-muted-foreground/90 flex h-full flex-1 flex-wrap items-center justify-between gap-2 text-sm select-none">
        <div className="flex items-center justify-center gap-2">
          <Icons.provider provider={modelData?.provider} />
          <span>{modelData?.displayName}</span>
        </div>

        <Popover>
          <PopoverTrigger className="flex h-10 w-10 shrink-0 items-center justify-center">
            <InfoIcon className="size-4" />
          </PopoverTrigger>

          <PopoverContent className="w-max p-4 text-sm" align="end">
            <div className="grid grid-cols-1 gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <ZapIcon className="size-4" />
                <span>{tokPerSec} tok/sec</span>
              </div>

              <div className="flex items-center gap-2">
                <ClockIcon className="size-4" />
                <span>Took {format.time(metadata.duration / 1000)}</span>
              </div>

              <div className="flex items-center gap-2">
                <CogIcon className="size-4" />
                <span>{format.number(metadata.totalTokens)} Tokens</span>
              </div>

              {metadata.thinkingTokens > 0 && (
                <div className="flex items-center gap-2">
                  <SparkleIcon className="size-4" />
                  <span>
                    {format.number(metadata.thinkingTokens)} {hiddenReasoning ? "Hidden" : ""}{" "}
                    Thinking
                  </span>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-muted-foreground/90 flex flex-wrap items-center text-sm select-none",
        "[&>*:not(:first-child)]:before:px-1.5 [&>*:not(:first-child)]:before:content-['-']",
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <Icons.provider provider={modelData?.provider} />
        <span>By {modelData?.displayName}</span>
      </div>

      <span className="flex items-center gap-1">
        <ZapIcon className="size-4" />
        {tokPerSec} tok/sec
      </span>

      <span className="flex items-center gap-1">
        <ClockIcon className="size-4" />
        {format.time(metadata.duration / 1000)}
      </span>

      <span className="flex items-center gap-1">
        <CogIcon className="size-4" />
        {format.number(metadata.totalTokens)} Tokens
      </span>

      {metadata.thinkingTokens > 0 && (
        <span className="flex items-center gap-1">
          <SparkleIcon className="size-4" />
          {format.number(metadata.thinkingTokens)} {hiddenReasoning ? "Hidden" : ""} Thinking
        </span>
      )}
    </div>
  );
}
