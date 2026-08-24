/* oxlint-disable react/no-array-index-key -- Rendered content blocks can repeat without stable IDs. */
import { useLoaderData } from "@tanstack/react-router";
import { ChevronDownIcon, Clock3Icon } from "lucide-react";

import { MessageContent as MessageBubble, MessageAvatar as UserAvatar } from "../ui/ai-elements/message";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Icons } from "../ui/icons";
import { Message, MessageAvatar, MessageContent as MessageLayoutContent, MessageHeader } from "../ui/message";

import {
  buildAssistantFlowBlocks,
  isFilePart,
  isTextPart,
  splitAssistantFlow,
  type AssistantFlowBlock,
} from "./message-flow";
import { MessageAttachmentsDisplay } from "./message-attachments-display";
import { StreamDownWrapper } from "./message-markdown";
import { MessagePending } from "./message-pending";
import { MessageReasoning } from "./message-reasoning";
import { MessageStepDivider, MessageToolParts } from "./message-tool-parts";

import { getUserDisplayName } from "@/lib/authkit/user";
import { clearMessageSelection, selectMessageText } from "@/lib/chat/message-selection";
import { tryGetModelData } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageContentProps = {
  message: ChatMessage;
  showUserAvatar?: boolean;
};

export function MessageContent({ message, showUserAvatar = true }: MessageContentProps) {
  const parts = message.parts ?? [];
  const error = message.error?.length ? message.error : "An error have occurred. Please try again.";

  const fileParts = parts.filter(isFilePart);
  const userTextParts = message.role === "user" ? parts.filter(isTextPart) : [];
  const assistantBlocks = message.role === "assistant" ? buildAssistantFlowBlocks(parts) : [];
  const assistantFlow = splitAssistantFlow(assistantBlocks, message);

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
  const isReasoningActive =
    modelData?.capabilities.reasoning != null && message.metadata?.modelParams.effort !== "none";

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
            {assistantFlow.hasFinalResponse && (
              <MessageWorkLog blocks={assistantFlow.workBlocks} message={message} />
            )}
            <AssistantBlocks blocks={assistantFlow.responseBlocks} message={message} />
          </div>
        )}

        {shouldRenderPending && <MessagePending isReasoning={isReasoningActive} />}

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

function AssistantBlocks({ blocks, message }: { blocks: AssistantFlowBlock[]; message: ChatMessage }) {
  return blocks.map((block) => {
    if (block.kind === "step-divider") return <MessageStepDivider key={block.key} />;

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

    return <AssistantTextBlock key={block.key} block={block} message={message} />;
  });
}

function AssistantTextBlock({
  block,
  message,
}: {
  block: Extract<AssistantFlowBlock, { kind: "text" }>;
  message: ChatMessage;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {block.parts.map((part, index) => (
        <MessageBubble
          key={`${message._id}-${block.key}-${index}`}
          className="surface-edge bg-background/75 backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
          onMouseDown={clearMessageSelection}
          onMouseUp={(event) => selectMessageText(event.currentTarget, event.target, event.detail)}
        >
          <StreamDownWrapper isAnimating={part.state === "streaming"} role={message.role}>
            {part.text}
          </StreamDownWrapper>
        </MessageBubble>
      ))}
    </div>
  );
}

function MessageWorkLog({ blocks, message }: { blocks: AssistantFlowBlock[]; message: ChatMessage }) {
  const durationMs = message.metadata?.durations.request ?? 0;
  const label = durationMs > 0 ? `Worked for ${formatWorkDuration(durationMs)}` : "Work log";

  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger className="surface-edge group flex min-h-8 w-full items-center gap-2 rounded-md border bg-background px-2 text-left text-sm text-muted-foreground transition-colors hover:border-ring hover:bg-background hover:text-foreground">
        <Clock3Icon className="size-4" />
        <span className="grow">{label}</span>
        <ChevronDownIcon className="size-4 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
        <div className="flex flex-col gap-1.5 pt-1.5">
          <p className="px-2 text-xs font-medium text-muted-foreground">Work log</p>
          <AssistantBlocks blocks={blocks} message={message} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatWorkDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
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
      {/* eslint-disable-next-line jsx-a11y/aria-role -- Streamdown uses role as a message-domain prop. */}
      <StreamDownWrapper role="assistant" isAnimating={false}>
        {message}
      </StreamDownWrapper>
    </div>
  );
}
