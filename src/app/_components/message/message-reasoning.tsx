import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ui/ai-elements/reasoning";

import { getModelData } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";

type ThinkingToggleProps = {
  messageId: string;
  model: ChatMessage["model"];
  status: ChatMessage["status"];
  parts: NonNullable<ChatMessage["parts"]>;
  metadata: ChatMessage["metadata"];
};

export function MessageReasoning({
  messageId,
  model,
  parts,
  status,
  metadata,
}: ThinkingToggleProps) {
  if (parts.length === 0 || status === "error") return null;

  const isReasoningModel = getModelData(model).capabilities.reasoning;
  if (!isReasoningModel) return null;

  const reasoning = parts
    .filter((p) => p.type === "reasoning")
    .map((p) => p.text)
    .join("\n\n");

  return (
    <Reasoning
      defaultOpen={false}
      isStreaming={status === "streaming"}
      duration={metadata?.durations?.reasoning}
    >
      <ReasoningTrigger className="w-max rounded-md bg-background/80 p-2 backdrop-blur-md backdrop-contrast-150" />
      <ReasoningContent className="w-full space-y-3 rounded-md border bg-card/80 p-3 backdrop-blur-md backdrop-contrast-150">
        {reasoning}
      </ReasoningContent>
    </Reasoning>
  );
}
