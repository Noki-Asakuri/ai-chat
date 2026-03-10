import {
  Message,
  MessageAvatar,
  MessageContent as MessageContentElement,
} from "../ui/ai-elements/message";

import { MessageAttachmentsDisplay } from "./message-attachments-display";
import { StreamDownWrapper } from "./message-markdown";
import { MessageReasoning } from "./message-reasoning";
import {
  MessageStepDivider,
  MessageToolParts,
  isToolPart,
  type ToolPart,
} from "./message-tool-parts";

import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessagePart = ChatMessage["parts"][number];
type ChatTextPart = MessagePart & { type: "text"; text: string; state?: "streaming" | "done" };
type ChatFilePart = MessagePart & {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
};
type ChatReasoningPart = MessagePart & {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
};

type ChatStepStartPart = MessagePart & { type: "step-start" };

type AssistantFlowBlock =
  | { kind: "text"; key: string; parts: ChatTextPart[] }
  | { kind: "reasoning"; key: string; parts: ChatReasoningPart[] }
  | { kind: "tools"; key: string; parts: ToolPart[] }
  | { kind: "step-divider"; key: string };

type MessageContentProps = {
  message: ChatMessage;
  showUserAvatar?: boolean;
};

function isTextPart(part: MessagePart): part is ChatTextPart {
  return part.type === "text";
}

function isFilePart(part: MessagePart): part is ChatFilePart {
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

function buildAssistantFlowBlocks(parts: MessagePart[]): AssistantFlowBlock[] {
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

  function getLastBlock(): AssistantFlowBlock | undefined {
    return blocks[blocks.length - 1];
  }

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;

    if (isFilePart(part)) {
      continue;
    }

    if (isStepStartPart(part)) {
      const hasRenderableAfter = index + 1 < parts.length && renderableFromIndex[index + 1]!;
      const lastBlock = getLastBlock();

      if (
        hasRenderableBefore &&
        hasRenderableAfter &&
        (lastBlock == null || lastBlock.kind !== "step-divider")
      ) {
        blocks.push({ kind: "step-divider", key: `step-${index}` });
      }
      continue;
    }

    if (isReasoningPart(part)) {
      hasRenderableBefore = true;
      const lastBlock = getLastBlock();

      if (lastBlock?.kind === "reasoning") {
        lastBlock.parts.push(part);
      } else {
        blocks.push({ kind: "reasoning", key: `reasoning-${index}`, parts: [part] });
      }
      continue;
    }

    if (isToolPart(part)) {
      hasRenderableBefore = true;
      const lastBlock = getLastBlock();

      if (lastBlock?.kind === "tools") {
        lastBlock.parts.push(part);
      } else {
        blocks.push({ kind: "tools", key: `tools-${index}`, parts: [part] });
      }
      continue;
    }

    if (isTextPart(part)) {
      hasRenderableBefore = true;
      const lastBlock = getLastBlock();

      if (lastBlock?.kind === "text") {
        lastBlock.parts.push(part);
      } else {
        blocks.push({ kind: "text", key: `text-${index}`, parts: [part] });
      }
    }
  }

  return blocks;
}

export function MessageContent({ message, showUserAvatar = true }: MessageContentProps) {
  const isMobile = useIsMobile();
  const parts = message.parts ?? [];

  if (message.status === "error") {
    const error = message.error?.length
      ? message.error
      : "An error have occurred. Please try again.";

    return <MessageError message={error} />;
  }

  const fileParts = parts.filter(isFilePart);
  const userTextParts = message.role === "user" ? parts.filter(isTextPart) : [];
  const assistantBlocks = message.role === "assistant" ? buildAssistantFlowBlocks(parts) : [];

  const shouldRenderUserAvatar = showUserAvatar && message.role === "user";
  const hasRenderableContent =
    fileParts.length > 0 ||
    (message.role === "assistant" ? assistantBlocks.length > 0 : userTextParts.length > 0);

  const shouldRenderUserMessageBody =
    message.role === "user" && (userTextParts.length > 0 || shouldRenderUserAvatar);
  const shouldReserveUserAvatarSpace = shouldRenderUserAvatar && userTextParts.length > 0;

  if (!hasRenderableContent && !shouldRenderUserAvatar) return null;

  return (
    <>
      <Message
        from={message.role}
        className="relative flex-col items-end [.is-assistant]:items-start"
      >
        <MessageAttachmentsDisplay
          parts={fileParts}
          attachments={message.attachments}
          role={message.role}
          messageId={message._id}
          className={cn(
            shouldRenderUserAvatar && "self-end",
            shouldReserveUserAvatarSpace && "max-w-[calc(100%-3.25rem)]",
            isMobile && shouldRenderUserAvatar && "mr-13",
          )}
        />

        {message.role === "assistant" && assistantBlocks.length > 0 && (
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            {assistantBlocks.map((block) => {
              if (block.kind === "step-divider") {
                return <MessageStepDivider key={block.key} />;
              }

              if (block.kind === "reasoning") {
                return (
                  <MessageReasoning
                    className="w-full"
                    key={block.key}
                    parts={block.parts}
                    status={message.status}
                    metadata={message.metadata}
                  />
                );
              }

              if (block.kind === "tools") {
                return <MessageToolParts key={block.key} parts={block.parts} />;
              }

              return (
                <div className="flex min-w-0 flex-col gap-1.5" key={block.key}>
                  {block.parts.map((part, index) => (
                    <MessageContentElement
                      key={`${message._id}-${block.key}-${index}`}
                      className="backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
                    >
                      <StreamDownWrapper
                        isAnimating={part.state === "streaming"}
                        role={message.role}
                      >
                        {part.text}
                      </StreamDownWrapper>
                    </MessageContentElement>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {shouldRenderUserMessageBody && (
          <div
            className={cn("relative flex items-start gap-2", {
              "w-full": message.role === "assistant",
              "max-w-full justify-end self-end": message.role === "user",
            })}
          >
            {userTextParts.length > 0 && (
              <div
                className={cn("flex min-w-0 flex-col gap-1.5", {
                  "w-full": message.role === "assistant",
                  "max-w-[calc(100%-3.25rem)]": shouldReserveUserAvatarSpace,
                })}
              >
                {userTextParts.map((part, i) => (
                  <MessageContentElement
                    key={`${message._id}-${i}`}
                    className="backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
                  >
                    <StreamDownWrapper isAnimating={part.state === "streaming"} role={message.role}>
                      {part.text}
                    </StreamDownWrapper>
                  </MessageContentElement>
                ))}
              </div>
            )}

            {shouldRenderUserAvatar && (
              <MessageAvatar
                className={cn("shrink-0", userTextParts.length === 0 && "self-start")}
              />
            )}
          </div>
        )}
      </Message>
    </>
  );
}

function MessageError({ message }: { message: string }) {
  return (
    <div
      data-slot="message-error"
      className="rounded-md bg-destructive/80 px-4 py-2 text-destructive-foreground backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-destructive"
    >
      <StreamDownWrapper role="assistant" isAnimating={false}>
        {message}
      </StreamDownWrapper>
    </div>
  );
}
