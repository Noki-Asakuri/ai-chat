import type { TextStreamPart, ToolSet } from "ai";

import type { ChatMetadata } from "@/libs/ai/types";

type CreateMessageMetadataOptions = {
  metadata: ChatMetadata;
  startTime: number;
};

export function createMessageMetadataHandler({
  metadata,
  startTime,
}: CreateMessageMetadataOptions) {
  let textStartTime = 0;
  let reasoningStartTime = 0;

  return function messageMetadata({ part }: { part: TextStreamPart<ToolSet> }) {
    switch (part.type) {
      case "reasoning-start":
        if (metadata.timeToFirstTokenMs === 0) {
          metadata.timeToFirstTokenMs = Date.now() - startTime;
          reasoningStartTime = Date.now();
        }
        break;

      case "reasoning-end":
        if (metadata.durations.reasoning === 0) {
          metadata.durations.reasoning = Date.now() - reasoningStartTime;
        }
        break;

      case "text-start":
        textStartTime = Date.now();
        if (metadata.timeToFirstTokenMs === 0) {
          metadata.timeToFirstTokenMs = Date.now() - startTime;
        }
        break;

      case "text-end":
        metadata.durations.text = Date.now() - textStartTime;
        break;

      case "finish-step":
        metadata.model.response = part.response.modelId;
        metadata.finishReason = part.finishReason;
        metadata.durations.request = Date.now() - startTime;

        metadata.usages.inputTokens = part.usage.inputTokens ?? metadata.usages.inputTokens;
        metadata.usages.outputTokens =
          part.usage.outputTokens ??
          part.usage.outputTokenDetails?.textTokens ??
          metadata.usages.outputTokens;

        metadata.usages.reasoningTokens =
          part.usage.reasoningTokens ??
          part.usage.outputTokenDetails?.reasoningTokens ??
          metadata.usages.reasoningTokens;
        break;

      case "finish":
        metadata.usages.inputTokens = part.totalUsage.inputTokens ?? 0;
        metadata.usages.outputTokens = part.totalUsage.outputTokenDetails.textTokens ?? 0;
        metadata.usages.reasoningTokens = part.totalUsage.outputTokenDetails.reasoningTokens ?? 0;

        return metadata;
    }

    return;
  };
}
