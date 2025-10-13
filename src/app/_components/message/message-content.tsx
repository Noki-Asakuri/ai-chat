import {
  Message,
  MessageAvatar,
  MessageContent as MessageContentElement,
} from "../ui/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ui/ai-elements/reasoning";

import { MessageAttachmentDisplay } from "./message-attachment-display";
import { MemoizedMarkdownBlock } from "./message-markdown";

import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { ChatMessage } from "@/lib/types";

type MessageContentProps = {
  message: ChatMessage;
  parts: ChatMessage["parts"];
};

export function MessageContent({ message, parts }: MessageContentProps) {
  const isMobile = useIsMobile();

  if (message.status === "error") {
    const error = message.error?.length
      ? message.error
      : "An error have occurred. Please try again.";

    return <MessageError message={error} />;
  }

  if (!parts || parts.length === 0) return null;

  return parts?.map((part, i) => {
    switch (part.type) {
      case "reasoning":
        return (
          <Reasoning
            key={`${message._id}-${i}`}
            isStreaming={message.status === "streaming"}
            duration={message.metadata?.durations?.reasoning}
            defaultOpen={false}
          >
            <ReasoningTrigger className="w-max rounded-md bg-background/80 p-2 backdrop-blur-md backdrop-contrast-150" />
            <ReasoningContent
              messageId={message._id}
              className="w-full space-y-3 rounded-md border bg-card/80 p-3 backdrop-blur-md backdrop-contrast-150"
            >
              {part.text}
            </ReasoningContent>
          </Reasoning>
        );

      case "text":
        return (
          <Message from={message.role} key={`${message._id}-${i}`} className="relative items-start">
            <MessageContentElement
              variant="contained"
              className="backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
            >
              <MemoizedMarkdownBlock
                content={part.text}
                isStreaming={message.status === "streaming"}
              />

              <MessageAttachmentDisplay attachments={message.attachments} messageId={message._id} />
            </MessageContentElement>

            {message.role === "user" && (
              <MessageAvatar className={!isMobile ? "-right-13 absolute top-0" : ""} />
            )}
          </Message>
        );

      default:
        return null;
    }
  });
}

function MessageError({ message }: { message: string }) {
  return (
    <div
      data-slot="message-error"
      className="rounded-md bg-destructive/80 px-4 py-2 text-destructive-foreground backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-destructive"
    >
      <MemoizedMarkdownBlock content={message} />
    </div>
  );
}
