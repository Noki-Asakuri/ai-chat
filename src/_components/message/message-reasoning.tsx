import type { ReasoningUIPart } from "ai";

import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ui/ai-elements/reasoning";

import type { UIChatMessage } from "@/lib/types";

type ThinkingToggleProps = {
  parts: ReasoningUIPart[];
  metadata: UIChatMessage["metadata"];
};

export function MessageReasoning({ parts, metadata }: ThinkingToggleProps) {
  if (parts.length === 0) return null;

  // const isReasoningModel = getModelData(model).capabilities.reasoning;
  // if (!isReasoningModel) return null;

  const reasoning = parts.map((p) => p.text).join("\n\n");

  return (
    <Reasoning defaultOpen={false} duration={metadata?.durations?.reasoning}>
      <ReasoningTrigger className="w-max rounded-md bg-background/80 p-2 backdrop-blur-md backdrop-contrast-150" />
      <ReasoningContent className="w-full space-y-3 rounded-md border bg-card/80 p-3 backdrop-blur-md backdrop-contrast-150">
        {reasoning}
      </ReasoningContent>
    </Reasoning>
  );
}
