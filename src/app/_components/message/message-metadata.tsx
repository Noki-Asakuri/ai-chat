import { BoltIcon, ClockIcon, HourglassIcon, InfoIcon, SparkleIcon, ZapIcon } from "lucide-react";

import { Icons } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getModelData } from "@/lib/chat/models";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";
import { cn, format } from "@/lib/utils";

// Convex
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type MessageMetadataProps = {
  metadata: ChatMessage["metadata"];
  model: string;
  hiddenReasoning: boolean;
};

export function MessageMetadata({ metadata, model, hiddenReasoning }: MessageMetadataProps) {
  const isMobile = useIsMobile();
  const aiProfileName = useAiProfileName(metadata?.aiProfileId);

  if (!metadata) return null;

  const modelData = getModelData(model);
  const tokPerSec =
    (metadata.durations?.text ?? metadata.duration) > 0
      ? (metadata.totalTokens / ((metadata.durations?.text ?? metadata.duration) / 1000)).toFixed(2)
      : 0;

  if (isMobile) {
    return (
      <div className="bg-background/80 flex h-full w-full flex-wrap items-center justify-between gap-2 rounded-md border px-4 text-sm backdrop-blur-md backdrop-saturate-150 select-none group-data-[disable-blur=true]/sidebar-provider:border-0">
        <div className="flex items-center justify-center gap-2">
          <Icons.provider provider={modelData?.provider} className="size-5 rounded-md" />
          <span>{modelData?.display.name}</span>
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
                <BoltIcon className="size-4" />
                <span>{format.number(metadata.totalTokens)} Tokens</span>
              </div>

              <div className="flex items-center gap-2">
                <HourglassIcon className="size-4" />
                <span>Took {format.time(metadata.duration / 1000)}</span>
              </div>

              {metadata.timeToFirstTokenMs && (
                <div className="flex items-center gap-2">
                  <ClockIcon className="size-4" />
                  <span>Latency {format.time(metadata.timeToFirstTokenMs / 1000)}</span>
                </div>
              )}

              {metadata.thinkingTokens > 0 && (
                <div className="flex items-center gap-2">
                  <SparkleIcon className="size-4" />
                  <span>
                    {format.number(metadata.thinkingTokens)} {hiddenReasoning ? "Hidden" : ""}{" "}
                    Thinking
                  </span>
                </div>
              )}

              {aiProfileName && (
                <div className="flex items-center gap-2">
                  <Icons.provider provider="openai" className="size-4" />
                  <span>Profile: {aiProfileName}</span>
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
        "bg-background/80 flex h-full w-full flex-wrap items-center rounded-md border px-4 py-2 text-xs backdrop-blur-md backdrop-saturate-150 select-none group-data-[disable-blur=true]/sidebar-provider:border-0",
        "[&>*:not(:first-child)]:before:px-1.5 [&>*:not(:first-child)]:before:content-['-']",
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <Icons.provider provider={modelData?.provider} className="size-5 rounded-md" />
        <span>By {modelData?.display.name}</span>
      </div>

      <span className="flex items-center gap-1">
        <ZapIcon className="size-4" />
        {tokPerSec} tok/sec
      </span>

      <span className="flex items-center gap-1">
        <HourglassIcon className="size-4" />
        {format.time((metadata.durations?.text ?? metadata.duration) / 1000)}
      </span>

      {metadata.timeToFirstTokenMs && (
        <span className="flex items-center gap-1">
          <ClockIcon className="size-4" />
          Latency {format.time(metadata.timeToFirstTokenMs / 1000)}
        </span>
      )}

      <span className="flex items-center gap-1">
        <BoltIcon className="size-4" />
        {format.number(metadata.totalTokens)} Tokens
      </span>

      {metadata.thinkingTokens > 0 && (
        <span className="flex items-center gap-1">
          <SparkleIcon className="size-4" />
          {format.number(metadata.thinkingTokens)} {hiddenReasoning ? "Hidden" : ""} Thinking
        </span>
      )}

      {aiProfileName && (
        <span className="flex items-center gap-1">
          {/* Reuse provider icon for visual consistency */}
          <Icons.provider provider="openai" className="size-4" />
          Profile: {aiProfileName}
        </span>
      )}
    </div>
  );
}

function useAiProfileName(aiProfileId?: Id<"ai_profiles">) {
  const enabled = Boolean(aiProfileId);
  const { data } = useQuery({
    ...convexQuery(api.functions.aiProfiles.getProfile, { profileId: aiProfileId }),
    enabled,
  });

  if (!enabled) return null;
  return data?.name ?? null;
}
