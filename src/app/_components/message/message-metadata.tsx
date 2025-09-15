import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { BoltIcon, BrainIcon, ClockIcon, HourglassIcon, InfoIcon, ZapIcon } from "lucide-react";

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
  const aiProfileName = useAiProfileName(metadata?.aiProfileId);
  if (!metadata) return null;

  const modelData = getModelData(model);
  const tokPerSec =
    (metadata.durations?.text ?? metadata.duration) > 0
      ? (metadata.totalTokens / ((metadata.durations?.text ?? metadata.duration) / 1000)).toFixed(2)
      : 0;

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

      <Popover>
        <PopoverTrigger className="flex h-10 w-10 shrink-0 items-center justify-center">
          <InfoIcon className="size-4" />
        </PopoverTrigger>

        <PopoverContent className="w-max bg-card p-2 text-sm" align="end" includeArrow={false}>
          <PopoverArrow className="fill-card" />

          <div className="grid grid-cols-1 gap-x-4 gap-y-2">
            <div data-slot="medatadata-tok-per-sec" className="flex items-center gap-2">
              <ZapIcon className="size-4" />
              <span>Speed: {tokPerSec} tok/sec</span>
            </div>

            <div data-slot="medatadata-total-tokens" className="flex items-center gap-2">
              <BoltIcon className="size-4" />
              <span>Comsume: {format.number(metadata.totalTokens)} Tokens</span>
            </div>

            <div
              data-slot="medatadata-thinking-tokens"
              className="flex items-center gap-2"
              hidden={metadata.thinkingTokens === 0}
            >
              <BrainIcon className="size-4" />
              <span>Thinking: {format.number(metadata.thinkingTokens)} Tokens</span>
            </div>

            <div data-slot="medatadata-duration" className="flex items-center gap-2">
              <HourglassIcon className="size-4" />
              <span>Duration: {format.time(metadata.duration / 1000)}</span>
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
              hidden={!aiProfileName}
            >
              <Icons.provider provider="openai" className="size-4" />
              <span>Profile: {aiProfileName}</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
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
