/* oxlint-disable react/no-array-index-key -- Rendered content blocks can repeat without stable IDs. */
import { ChevronRightIcon, Clock3Icon, TriangleAlertIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Icons } from "../ui/icons";

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
import { MessageUserText } from "./message-user-text";

import { tryGetModelData } from "@/lib/chat/models";
import type { ChatMessage } from "@/lib/types";

type MessageContentProps = {
  message: ChatMessage;
};

export function MessageContent({ message }: MessageContentProps) {
  if (message.role === "user") return <UserMessageContent message={message} />;
  return <AssistantMessageContent message={message} />;
}

function UserMessageContent({ message }: MessageContentProps) {
  const parts = message.parts ?? [];
  const fileParts = parts.filter(isFilePart);
  const textParts = parts.filter(isTextPart);

  if (message.status === "error") {
    return (
      <div className="flex w-full justify-end">
        <MessageError message={getErrorText(message)} />
      </div>
    );
  }

  if (fileParts.length === 0 && textParts.length === 0) return null;

  return (
    <div data-slot="message-content" className="flex w-full min-w-0 flex-col items-end gap-1.5">
      <MessageAttachmentsDisplay
        parts={fileParts}
        attachments={message.attachments}
        role={message.role}
        messageId={message._id}
        className="max-w-[85%] items-end sm:max-w-[80%]"
      />

      {textParts.map((part, i) => (
        <div
          key={`${message._id}-${i}`}
          data-slot="message-bubble"
          className="max-w-[85%] min-w-0 rounded-2xl rounded-br-md bg-secondary px-3.5 py-2.5 wrap-break-word text-secondary-foreground sm:max-w-[80%] sm:px-4 sm:py-3"
        >
          <MessageUserText text={part.text} attachments={message.attachments} />
        </div>
      ))}
    </div>
  );
}

function AssistantMessageContent({ message }: MessageContentProps) {
  const parts = message.parts ?? [];
  const fileParts = parts.filter(isFilePart);
  const blocks = buildAssistantFlowBlocks(parts);
  const flow = splitAssistantFlow(blocks, message);

  const modelId = message.metadata?.model.request;
  const modelData = modelId ? tryGetModelData(modelId) : null;
  const isReasoningActive =
    modelData?.capabilities.reasoning != null && message.metadata?.modelParams.effort !== "none";
  const isGenerating = message.status === "pending" || message.status === "streaming";

  return (
    <div data-slot="message-content" className="flex w-full min-w-0 flex-col gap-2 px-0.5 sm:px-1">
      <div
        data-slot="message-header"
        className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        {modelData ? (
          <Icons.provider provider={modelData.provider} className="size-3.5 shrink-0" />
        ) : (
          <Icons.unknown className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{modelData?.display.name ?? modelId ?? "Model"}</span>
      </div>

      {message.status === "error" ? (
        <MessageError message={getErrorText(message)} />
      ) : (
        <>
          <MessageAttachmentsDisplay
            parts={fileParts}
            attachments={message.attachments}
            role={message.role}
            messageId={message._id}
          />

          {blocks.length > 0 && (
            <div className="flex w-full min-w-0 flex-col gap-2">
              {flow.hasFinalResponse && <MessageWorkLog blocks={flow.workBlocks} message={message} />}
              <AssistantBlocks blocks={flow.responseBlocks} message={message} />
            </div>
          )}

          {isGenerating && blocks.length === 0 && <MessagePending isReasoning={isReasoningActive} />}
        </>
      )}
    </div>
  );
}

function getErrorText(message: ChatMessage): string {
  return message.error?.length ? message.error : "An error have occurred. Please try again.";
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
      return (
        <MessageToolParts
          key={block.key}
          parts={block.parts}
          isStreaming={message.status === "streaming" || message.status === "pending"}
        />
      );
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
  if (!block.parts.some((part) => part.text.trim().length > 0)) return null;

  return (
    <div data-slot="message-text" className="flex min-w-0 flex-col gap-2">
      {block.parts.map((part, index) =>
        part.text.trim().length > 0 ? (
          <StreamDownWrapper
            key={`${message._id}-${block.key}-${index}`}
            isAnimating={part.state === "streaming"}
            role={message.role}
          >
            {part.text}
          </StreamDownWrapper>
        ) : null,
      )}
    </div>
  );
}

function MessageWorkLog({ blocks, message }: { blocks: AssistantFlowBlock[]; message: ChatMessage }) {
  const durationMs = message.metadata?.durations.request ?? 0;
  const label = durationMs > 0 ? `Worked for ${formatWorkDuration(durationMs)}` : "Work log";

  return (
    <Collapsible className="w-full border-b border-border/60 pb-1.5">
      <CollapsibleTrigger className="group/work-log -mx-1 flex h-7 w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60">
        <Clock3Icon className="size-3.5 shrink-0" />
        <span className="min-w-0 grow truncate tabular-nums">{label}</span>
        <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-data-panel-open/work-log:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none [&[hidden]:not([hidden='until-found'])]:hidden">
        <div className="ml-[0.4375rem] flex flex-col gap-2 border-l border-border/70 py-1.5 pl-3.5">
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

function MessageError({ message }: { message: string }) {
  return (
    <div
      data-slot="message-error"
      role="alert"
      className="flex max-w-full min-w-0 items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {/* eslint-disable-next-line jsx-a11y/aria-role -- Streamdown uses role as a message-domain prop. */}
      <StreamDownWrapper role="assistant" isAnimating={false} className="min-w-0 text-sm">
        {message}
      </StreamDownWrapper>
    </div>
  );
}
