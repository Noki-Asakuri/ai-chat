import type { TextStreamPart, ToolSet } from "ai";

import type { ChatMetadata } from "@/libs/ai/types";

type CreateMessageMetadataOptions = {
  metadata: ChatMetadata;
  startTime: number;
};

export function createMessageMetadataHandler({ metadata, startTime }: CreateMessageMetadataOptions) {
  let textStartTime = 0;
  let reasoningStartTime = 0;
  let stepsSeen = 0;
  let inputComplete = true;
  let outputComplete = true;

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

      case "finish-step": {
        stepsSeen++;
        // Adapters can normalize missing counts to zero; only raw usage proves reporting.
        const raw = part.usage.raw;
        inputComplete &&= (raw?.prompt_tokens ?? raw?.input_tokens ?? raw?.promptTokenCount) != null;
        outputComplete &&=
          (raw?.completion_tokens ?? raw?.output_tokens) != null ||
          (raw?.candidatesTokenCount != null &&
            (raw.thoughtsTokenCount != null ||
              // Without a reasoning count, Google's total must account for all tokens.
              (raw.promptTokenCount != null &&
                raw.totalTokenCount != null &&
                raw.totalTokenCount === part.usage.totalTokens)));

        metadata.model.response = part.response.modelId;
        metadata.finishReason = part.finishReason;
        metadata.durations.request = Date.now() - startTime;

        break;
      }

      case "finish": {
        const usage = part.totalUsage;
        const reasoningTokens = usage.outputTokenDetails.reasoningTokens;
        const textTokens = usage.outputTokenDetails.textTokens;
        const outputTokens =
          usage.outputTokens ??
          (textTokens !== undefined && reasoningTokens !== undefined
            ? textTokens + reasoningTokens
            : undefined);

        metadata.usages.inputTokens = usage.inputTokens ?? 0;
        metadata.usages.outputTokens =
          textTokens ??
          (outputTokens !== undefined && reasoningTokens !== undefined ? outputTokens - reasoningTokens : 0);
        metadata.usages.reasoningTokens = reasoningTokens ?? 0;
        metadata.usages.totalOutputTokens = outputTokens;
        metadata.usages.inputReported = stepsSeen > 0 && inputComplete && usage.inputTokens !== undefined;
        metadata.usages.outputReported = stepsSeen > 0 && outputComplete && outputTokens !== undefined;

        return metadata;
      }
    }

    return undefined;
  };
}
