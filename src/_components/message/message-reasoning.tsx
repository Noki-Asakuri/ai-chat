import type { ReasoningUIPart } from "ai";

import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ui/ai-elements/reasoning";

import { tryGetModelData } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";

type ChatReasoningPart = ChatMessage["parts"][number] & ReasoningUIPart;

type ThinkingToggleProps = {
  parts: ChatReasoningPart[];
  status: ChatMessage["status"];
  metadata: ChatMessage["metadata"];
  className?: string;
};

export function MessageReasoning({ parts, metadata, className }: ThinkingToggleProps) {
  if (!metadata) return null;

  const modelData = tryGetModelData(metadata.model.request);
  if (!modelData) return null;

  const isReasoningModel = modelData.capabilities.reasoning;
  if (!isReasoningModel || metadata.modelParams.effort === "none") return null;

  const reasoning = parts.map((p) => p.text).join("\n\n");
  const isReasoningStreaming = parts.some((p) => p.state === "streaming");

  if (reasoning.length === 0) return null;

  return (
    <Reasoning className={className} defaultOpen={false} isStreaming={isReasoningStreaming}>
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
