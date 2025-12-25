import type { ReasoningUIPart } from "ai";

import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ui/ai-elements/reasoning";

import { getModelData } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";

type ThinkingToggleProps = {
  parts: ReasoningUIPart[];
  status: ChatMessage["status"];
  metadata: ChatMessage["metadata"];
};

export function MessageReasoning({ parts, status, metadata }: ThinkingToggleProps) {
  if (!metadata) return null;

  const isReasoningModel = getModelData(metadata.model.request).capabilities.reasoning;
  if (!isReasoningModel || metadata.modelParams.effort === "none") return null;

  const reasoning = parts.map((p) => p.text).join("\n\n");
  const isReasoningStreaming = parts.some((p) => p.state === "streaming");

  if (metadata.durations.reasoning === 0 && status === "complete") return null;

  return (
    <Reasoning
      defaultOpen={false}
      duration={metadata.durations.reasoning}
      isStreaming={isReasoningStreaming}
    >
      <ReasoningTrigger
        disabled={reasoning.length === 0}
        showArrow={reasoning.length > 0}
        className="w-max rounded-md bg-background/80 p-2 backdrop-blur-md backdrop-contrast-150"
      />

      {reasoning.length > 0 && (
        <ReasoningContent className="w-full space-y-3 rounded-md border bg-card/80 p-3 backdrop-blur-md backdrop-contrast-150">
          {reasoning}
        </ReasoningContent>
      )}
    </Reasoning>
  );
}
