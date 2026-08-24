import type { ChatMessage } from "@/lib/types";

import { isToolPart, type ToolPart } from "./message-tool-parts/shared";

type MessagePart = ChatMessage["parts"][number];
export type ChatTextPart = MessagePart & {
  type: "text";
  text: string;
  state?: "streaming" | "done";
};
export type ChatFilePart = MessagePart & {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
};
export type ChatReasoningPart = MessagePart & {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
};

type ChatStepStartPart = MessagePart & { type: "step-start" };

export type AssistantFlowBlock =
  | { kind: "text"; key: string; parts: ChatTextPart[] }
  | { kind: "reasoning"; key: string; parts: ChatReasoningPart[] }
  | { kind: "tools"; key: string; parts: ToolPart[] }
  | { kind: "step-divider"; key: string };

export type AssistantFlow = {
  workBlocks: AssistantFlowBlock[];
  responseBlocks: AssistantFlowBlock[];
  hasFinalResponse: boolean;
};

export function isTextPart(part: MessagePart): part is ChatTextPart {
  return part.type === "text";
}

export function isFilePart(part: MessagePart): part is ChatFilePart {
  return part.type === "file";
}

function isReasoningPart(part: MessagePart): part is ChatReasoningPart {
  return part.type === "reasoning";
}

function isStepStartPart(part: MessagePart): part is ChatStepStartPart {
  return part.type === "step-start";
}

function isRenderableAssistantPart(part: MessagePart): boolean {
  return isTextPart(part) || isReasoningPart(part) || isToolPart(part);
}

export function buildAssistantFlowBlocks(parts: MessagePart[]): AssistantFlowBlock[] {
  if (parts.length === 0) return [];

  const renderableFromIndex: boolean[] = Array.from({ length: parts.length }, () => false);

  let hasRenderableAhead = false;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]!;
    hasRenderableAhead = hasRenderableAhead || isRenderableAssistantPart(part);
    renderableFromIndex[index] = hasRenderableAhead;
  }

  const blocks: AssistantFlowBlock[] = [];
  let hasRenderableBefore = false;
  let stepToolBlock: Extract<AssistantFlowBlock, { kind: "tools" }> | undefined;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;

    if (isFilePart(part)) continue;

    if (isStepStartPart(part)) {
      const hasRenderableAfter = index + 1 < parts.length && renderableFromIndex[index + 1]!;
      const lastBlock = blocks.at(-1);

      if (
        hasRenderableBefore &&
        hasRenderableAfter &&
        (lastBlock == null || lastBlock.kind !== "step-divider")
      ) {
        blocks.push({ kind: "step-divider", key: `step-${index}` });
      }

      stepToolBlock = undefined;
      continue;
    }

    if (isReasoningPart(part)) {
      hasRenderableBefore = true;
      const lastBlock = blocks.at(-1);

      if (lastBlock?.kind === "reasoning") {
        lastBlock.parts.push(part);
      } else {
        blocks.push({ kind: "reasoning", key: `reasoning-${index}`, parts: [part] });
      }
      continue;
    }

    if (isToolPart(part)) {
      hasRenderableBefore = true;

      if (stepToolBlock) {
        stepToolBlock.parts.push(part);
      } else {
        stepToolBlock = { kind: "tools", key: `tools-${index}`, parts: [part] };
        blocks.push(stepToolBlock);
      }
      continue;
    }

    if (isTextPart(part)) {
      hasRenderableBefore = true;
      const lastBlock = blocks.at(-1);

      if (lastBlock?.kind === "text") {
        lastBlock.parts.push(part);
      } else {
        blocks.push({ kind: "text", key: `text-${index}`, parts: [part] });
      }
    }
  }

  return blocks;
}

export function splitAssistantFlow(
  blocks: AssistantFlowBlock[],
  message: {
    status: ChatMessage["status"];
    metadata?: { finishReason?: string | null };
  },
): AssistantFlow {
  const finalBlock = blocks.at(-1);
  const hasFinalText =
    finalBlock?.kind === "text" && finalBlock.parts.some((part) => part.text.trim().length > 0);
  const hasWork = blocks.slice(0, -1).some((block) => block.kind === "reasoning" || block.kind === "tools");
  if (
    message.status === "complete" &&
    message.metadata?.finishReason !== "aborted" &&
    hasFinalText &&
    hasWork &&
    finalBlock?.kind === "text"
  ) {
    const workBlocks = blocks.slice(0, -1);
    if (workBlocks.at(-1)?.kind === "step-divider") workBlocks.pop();

    return { workBlocks, responseBlocks: [finalBlock], hasFinalResponse: true };
  }

  return { workBlocks: [], responseBlocks: blocks, hasFinalResponse: false };
}
