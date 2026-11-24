import type { ReasoningUIPart } from "@ai-chat/shared/chat/ui";

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
        className="-mx-1 h-7 rounded-md px-1 hover:bg-muted/50 [&_[data-slot=trace-line]]:text-sm"
      />

      {reasoning.length > 0 && (
        <ReasoningContent className="mt-1 max-h-96 w-full overflow-y-auto overscroll-contain">
          {reasoning}
        </ReasoningContent>
      )}
    </Reasoning>
  );
}
