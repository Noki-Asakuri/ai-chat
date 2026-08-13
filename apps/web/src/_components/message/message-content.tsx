import { useLoaderData } from "@tanstack/react-router";

import { MessageContent as MessageBubble, MessageAvatar as UserAvatar } from "../ui/ai-elements/message";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Icons } from "../ui/icons";
import { Message, MessageAvatar, MessageContent as MessageLayoutContent, MessageHeader } from "../ui/message";

import { MessageAttachmentsDisplay } from "./message-attachments-display";
import { StreamDownWrapper } from "./message-markdown";
import { MessagePending } from "./message-pending";
import { MessageReasoning } from "./message-reasoning";
import { MessageStepDivider, MessageToolParts, isToolPart, type ToolPart } from "./message-tool-parts";

import { getUserDisplayName } from "@/lib/authkit/user";
import { clearMessageSelection, selectMessageText } from "@/lib/chat/message-selection";
import { tryGetModelData } from "@/lib/chat/models";
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
        const { parts } = lastBlock;
        parts.push(part);
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
  const parts = message.parts ?? [];
  const error = message.error?.length ? message.error : "An error have occurred. Please try again.";

  const fileParts = parts.filter(isFilePart);
  const userTextParts = message.role === "user" ? parts.filter(isTextPart) : [];
  const assistantBlocks = message.role === "assistant" ? buildAssistantFlowBlocks(parts) : [];

  const shouldRenderUserAvatar = showUserAvatar && message.role === "user";
  const shouldRenderPending =
    message.role === "assistant" &&
    (message.status === "pending" || message.status === "streaming") &&
    assistantBlocks.length === 0;
  const hasRenderableContent =
    message.status === "error" ||
    shouldRenderPending ||
    fileParts.length > 0 ||
    (message.role === "assistant" ? assistantBlocks.length > 0 : userTextParts.length > 0);

  const shouldRenderUserMessageBody = message.role === "user" && userTextParts.length > 0;
  const modelId = message.metadata?.model.request;
  const modelData = modelId ? tryGetModelData(modelId) : null;

  if (message.role === "user" && !hasRenderableContent && !shouldRenderUserAvatar) return null;

  return (
    <Message
      align={message.role === "user" ? "end" : "start"}
      className={cn("relative text-base", message.role === "user" ? "is-user" : "is-assistant")}
    >
      {message.role === "assistant" && (
        <MessageAvatar className="self-start rounded-md bg-transparent">
          <Avatar className="size-11 ring-1 ring-border">
            <AvatarFallback className="bg-background/75">
              {modelData ? (
                <Icons.provider provider={modelData.provider} className="size-7" />
              ) : (
                <Icons.unknown className="size-7" />
              )}
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>
      )}

      {shouldRenderUserAvatar && (
        <MessageAvatar className="self-start rounded-md bg-transparent">
          <UserAvatar />
        </MessageAvatar>
      )}

      <MessageLayoutContent className="items-end group-data-[align=start]/message:items-start">
        {message.role === "assistant" && (
          <MessageHeader className="px-0 text-base leading-5 text-foreground">
            {modelData?.display.name ?? modelId ?? "Model"}
          </MessageHeader>
        )}

        {shouldRenderUserAvatar && <UserMessageHeader />}

        {message.status === "error" ? (
          <MessageError message={error} />
        ) : (
          <MessageAttachmentsDisplay
            parts={fileParts}
            attachments={message.attachments}
            role={message.role}
            messageId={message._id}
            className={cn(shouldRenderUserAvatar && "self-end")}
          />
        )}

        {message.status !== "error" && message.role === "assistant" && assistantBlocks.length > 0 && (
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
                    <MessageBubble
                      key={`${message._id}-${block.key}-${index}`}
                      className="surface-edge bg-background/75 backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
                      onMouseDown={clearMessageSelection}
                      onMouseUp={(event) =>
                        selectMessageText(
                          event.currentTarget,
                          event.target,
                          event.detail,
                          event.clientX,
                          event.clientY,
                        )
                      }
                    >
                      <StreamDownWrapper isAnimating={part.state === "streaming"} role={message.role}>
                        {part.text}
                      </StreamDownWrapper>
                    </MessageBubble>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {shouldRenderPending && <MessagePending />}

        {message.status !== "error" && shouldRenderUserMessageBody && (
          <div className="relative flex max-w-full items-start justify-end gap-2 self-end">
            {userTextParts.length > 0 && (
              <div className="flex min-w-0 flex-col gap-1.5">
                {userTextParts.map((part, i) => (
                  <MessageBubble
                    key={`${message._id}-${i}`}
                    className="surface-edge bg-background/75 backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
                  >
                    <StreamDownWrapper isAnimating={part.state === "streaming"} role={message.role}>
                      {part.text}
                    </StreamDownWrapper>
                  </MessageBubble>
                ))}
              </div>
            )}
          </div>
        )}
      </MessageLayoutContent>
    </Message>
  );
}

function UserMessageHeader() {
  const { user } = useLoaderData({ from: "/_chat" });

  return (
    <MessageHeader className="px-0 text-base leading-5 text-foreground">
      {getUserDisplayName(user)}
    </MessageHeader>
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
