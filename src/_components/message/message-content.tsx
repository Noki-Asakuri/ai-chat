import {
  Message,
  MessageAvatar,
  MessageContent as MessageContentElement,
} from "../ui/ai-elements/message";

import { MessageAttachmentDisplay } from "./message-attachment-display";
import { MemoizedMarkdownBlock } from "./message-markdown";
import { MessageReasoning } from "./message-reasoning";

import { useIsMobile } from "@/lib/hooks/use-mobile";
import type { UIChatMessage } from "@/lib/types";

type MessageContentProps = {
  message: UIChatMessage;
};

export function MessageContent({ message }: MessageContentProps) {
  const isMobile = useIsMobile();

  // if (message.status === "error") {
  //   const error = message.error?.length
  //     ? message.error
  //     : "An error have occurred. Please try again.";

  //   return <MessageError message={error} />;
  // }

  if (!message.parts || message.parts.length === 0) return null;

  const reasoningParts = message.parts.filter((p) => p.type === "reasoning");
  const textParts = message.parts.filter((p) => p.type === "text");

  return (
    <>
      <MessageReasoning parts={reasoningParts} metadata={message.metadata} />

      <Message from={message.role} className="relative items-start">
        {textParts.map((part, i) => (
          <MessageContentElement
            key={`${message.id}-${i}`}
            className="backdrop-blur-md backdrop-saturate-150 group-data-[role=assistant]:w-full md:p-4"
          >
            <MemoizedMarkdownBlock
              content={part.text}
              // isStreaming={message.status === "streaming"}
            />

            {/* <MessageAttachmentDisplay attachments={message.attachments} messageId={message._id} /> */}
          </MessageContentElement>
        ))}

        {message.role === "user" && (
          <MessageAvatar className={!isMobile ? "absolute top-0 -right-13" : ""} />
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
      <MemoizedMarkdownBlock content={message} isStreaming={false} />
    </div>
  );
}
