import { BanIcon } from "lucide-react";

import {
  Message,
  MessageAvatar,
  MessageContent as MessageContentElement,
} from "../ui/ai-elements/message";

import { MessageAttachmentsDisplay } from "./message-attachments-display";
import { StreamDownWrapper } from "./message-markdown";
import { MessageReasoning } from "./message-reasoning";

import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageContentProps = {
  message: ChatMessage;
};

export function MessageContent({ message }: MessageContentProps) {
  const isMobile = useIsMobile();

  if (message.status === "error") {
    const error = message.error?.length
      ? message.error
      : "An error have occurred. Please try again.";

    return <MessageError message={error} />;
  }

  if (!message.parts || message.parts.length === 0) return null;

  const textParts = message.parts.filter((p) => p.type === "text");
  const fileParts = message.parts.filter((p) => p.type === "file");
  const reasoningParts = message.parts.filter((p) => p.type === "reasoning");

  return (
    <>
      <MessageReasoning
        parts={reasoningParts}
        status={message.status}
        metadata={message.metadata}
      />

      <Message
        from={message.role}
        className="relative flex-col items-end [.is-assistant]:flex-col-reverse [.is-assistant]:items-start"
      >
        <MessageAttachmentsDisplay
          parts={fileParts}
          role={message.role}
          messageId={message._id}
          className={cn({ "mr-13": isMobile })}
        />

        <div className="relative flex gap-2 group-[.is-assistant]:w-full group-[.is-user]:max-w-full">
          {textParts.map((part, i) => (
            <MessageContentElement
              key={`${message._id}-${i}`}
              className="backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
            >
              <StreamDownWrapper role={message.role}>{part.text}</StreamDownWrapper>
            </MessageContentElement>
          ))}

          {message.role === "user" && (
            <MessageAvatar className={cn({ "absolute top-0 -right-13": !isMobile })} />
          )}
        </div>
      </Message>

      {message.role === "assistant" && message.metadata?.finishReason === "aborted" && (
        <div className="mt-2 flex w-full justify-center">
          <div className="inline-flex items-center gap-2 rounded-md border border-destructive/50 bg-background/80 px-3 py-1 text-sm font-medium text-destructive backdrop-blur-md backdrop-saturate-150">
            <BanIcon className="size-4" />
            <span>Cancelled</span>
          </div>
        </div>
      )}
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
