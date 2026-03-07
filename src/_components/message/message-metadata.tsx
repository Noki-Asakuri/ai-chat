import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { useQueryClient } from "@tanstack/react-query";
import {
  BoltIcon,
  BrainIcon,
  ClockIcon,
  HourglassIcon,
  InfoIcon,
  QuoteIcon,
  ZapIcon,
} from "lucide-react";

import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Icons } from "@/components/ui/icons";

import { tryGetModelData } from "@/lib/chat/models";
import { convexSessionQuery } from "@/lib/convex/helpers";
import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";
type MessageMetadataProps = {
  metadata: ChatMessage["metadata"];
};

export function MessageMetadata({ metadata }: MessageMetadataProps) {
  if (!metadata) return null;

  const modelData = tryGetModelData(metadata.model.request);
  if (!modelData) return null;

  const hasFullMetadata =
    metadata.usages.inputTokens > 0 ||
    metadata.usages.outputTokens > 0 ||
    metadata.usages.reasoningTokens > 0 ||
    metadata.durations.request > 0 ||
    metadata.durations.text > 0 ||
    (metadata.timeToFirstTokenMs ?? 0) > 0;

  if (!hasFullMetadata) return null;

  return <PopoverInfo metadata={metadata} />;
}

type PopoverInfoProps = { metadata: ChatMessage["metadata"] };

function PopoverInfo({ metadata }: PopoverInfoProps) {
  const queryClient = useQueryClient();
  if (!metadata) return null;

  function getProfile() {
    if (!metadata || !metadata.modelParams.profile) return null;

    const data = queryClient.getQueryData<Doc<"profiles">[]>(
      convexSessionQuery(api.functions.profiles.getProfile).queryKey,
    );

    return data?.find((p) => p._id === metadata.modelParams.profile) ?? null;
  }

  const outputTokenCount = metadata.usages.outputTokens + metadata.usages.reasoningTokens;
  const tokPerSec =
    metadata.durations.text > 0
      ? (outputTokenCount / (metadata.durations.text / 1000)).toFixed(2)
      : null;

  return (
    <Popover>
      <PopoverTrigger className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background/80 p-0 backdrop-blur-md backdrop-saturate-150">
        <InfoIcon className="size-4" />
      </PopoverTrigger>

      <PopoverContent
        className="w-max bg-card p-2 text-sm"
        align="end"
        side="left"
        sideOffset={12}
        includeArrow={false}
      >
        <PopoverArrow className="fill-card" />

        <div className="grid grid-cols-1 gap-x-4 gap-y-2">
          <div
            data-slot="metadata-tok-per-sec"
            className="flex items-center gap-2"
            hidden={tokPerSec === null}
          >
            <ZapIcon className="size-4" />
            <span>Speed: {tokPerSec ?? "-"} tok/sec</span>
          </div>

          <div
            data-slot="metadata-input-tokens"
            className="flex items-center gap-2"
            hidden={metadata.usages.inputTokens === 0}
          >
            <QuoteIcon className="size-4" />
            <span>Input: {format.number(metadata.usages.inputTokens)} Tokens</span>
          </div>

          <div data-slot="metadata-total-tokens" className="flex items-center gap-2">
            <BoltIcon className="size-4" />
            <span>Consume: {format.number(metadata.usages.outputTokens)} Tokens</span>
          </div>

          <div
            data-slot="metadata-thinking-tokens"
            className="flex items-center gap-2"
            hidden={metadata.usages.reasoningTokens === 0}
          >
            <BrainIcon className="size-4" />
            <span>Reasoning: {format.number(metadata.usages.reasoningTokens)} Tokens</span>
          </div>

          <div data-slot="metadata-duration" className="flex items-center gap-2">
            <HourglassIcon className="size-4" />
            <span>Duration: {format.time(metadata.durations.request / 1000)}</span>
          </div>

          <div
            data-slot="metadata-latency"
            className="flex items-center gap-2"
            hidden={!metadata.timeToFirstTokenMs}
          >
            <ClockIcon className="size-4" />
            <span title="Time to First Token">
              TTFT: {format.time((metadata.timeToFirstTokenMs ?? 0) / 1000)}
            </span>
          </div>

          <div
            data-slot="metadata-ai-profile"
            className="flex items-center gap-2"
            hidden={!metadata.modelParams.profile}
          >
            <Icons.provider provider="openai" className="size-4" />
            <span>Profile: {getProfile()?.name ?? "Unknown"}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
