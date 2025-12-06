import {
  BoltIcon,
  BrainIcon,
  ClockIcon,
  HourglassIcon,
  InfoIcon,
  QuoteIcon,
  ZapIcon,
} from "lucide-react";

import { Icons } from "@/components/ui/icons";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getModelData } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";
import { format } from "@/lib/utils";

type MessageMetadataProps = {
  metadata: ChatMessage["metadata"];
  params: ChatMessage["modelParams"];
  model: string;
};

export function MessageMetadata({ metadata, params, model }: MessageMetadataProps) {
  if (!model) return null;

  const modelData = getModelData(model);

  const showEffort =
    typeof modelData.capabilities.reasoning === "boolean" &&
    modelData.capabilities.reasoning === true &&
    params?.effort &&
    params.effort !== "medium";

  return (
    <div className="flex h-full w-full items-center justify-between">
      <div className="flex h-10.5 items-center justify-center gap-2 rounded-md border bg-background/80 p-2 backdrop-blur-md backdrop-saturate-150">
        <Icons.provider provider={modelData?.provider} className="size-4 rounded-md" />
        {modelData?.display.name}{" "}
        {showEffort && <span className="text-sm capitalize">({params?.effort})</span>}
      </div>

      <PopoverInfo metadata={metadata} />
    </div>
  );
}

type PopoverInfoProps = {
  metadata: ChatMessage["metadata"];
};

function PopoverInfo({ metadata }: PopoverInfoProps) {
  if (!metadata) return null;

  const tokPerSec = (
    (metadata.usages.outputTokens + metadata.usages.reasoningTokens) /
    (metadata.durations.text / 1000)
  ).toFixed(2);

  return (
    <Popover>
      <PopoverTrigger className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background/80 p-0 backdrop-blur-md backdrop-saturate-150">
        <InfoIcon className="size-4" />
      </PopoverTrigger>

      <PopoverContent
        className="w-max bg-card p-2 text-sm"
        align="end"
        sideOffset={12}
        includeArrow={false}
      >
        <PopoverArrow className="fill-card" />

        <div className="grid grid-cols-1 gap-x-4 gap-y-2">
          <div data-slot="metadata-tok-per-sec" className="flex items-center gap-2">
            <ZapIcon className="size-4" />
            <span>Speed: {tokPerSec} tok/sec</span>
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
            hidden={!metadata.profile}
          >
            <Icons.provider provider="openai" className="size-4" />
            <span>Profile: {metadata.profile?.name}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
