import type { ReasoningUIPart } from "ai";

import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ui/ai-elements/reasoning";

import { tryGetModelData } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";

type ThinkingToggleProps = {
  parts: ReasoningUIPart[];
  status: ChatMessage["status"];
  metadata: ChatMessage["metadata"];
  className?: string;
};

export function MessageReasoning({ parts, status, metadata, className }: ThinkingToggleProps) {
  if (!metadata) return null;

  const modelData = tryGetModelData(metadata.model.request);
  if (!modelData) return null;

  const isReasoningModel = modelData.capabilities.reasoning;
  if (!isReasoningModel || metadata.modelParams.effort === "none") return null;

  const reasoning = parts.map((p) => p.text).join("\n\n");
  const isReasoningStreaming = parts.some((p) => p.state === "streaming");

  if (metadata.durations.reasoning === 0 && status === "complete") return null;

  return (
    <Reasoning
      defaultOpen={false}
      duration={metadata.durations.reasoning}
      isStreaming={isReasoningStreaming}
      className={className}
    >
      <ReasoningTrigger
        disabled={reasoning.length === 0}
        showArrow={reasoning.length > 0}
        className="w-max rounded-full border border-border/60 bg-card/70 px-3 py-1.5 backdrop-blur-md backdrop-contrast-150"
      />

      {reasoning.length > 0 && (
        <ReasoningContent className="w-full space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur-md backdrop-contrast-150">
          {reasoning}
        </ReasoningContent>
      )}
    </Reasoning>
  );
}
