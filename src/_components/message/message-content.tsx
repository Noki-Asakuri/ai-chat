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
  showUserAvatar?: boolean;
};

export function MessageContent({ message, showUserAvatar = true }: MessageContentProps) {
  const isMobile = useIsMobile();
  const parts = message.parts ?? [];

  if (message.status === "error") {
    const error = message.error?.length
      ? message.error
      : "An error have occurred. Please try again.";

    return <MessageError message={error} />;
  }

  const textParts = parts.filter((part) => part.type === "text");
  const fileParts = parts.filter((part) => part.type === "file");
  const reasoningParts = parts.filter((part) => part.type === "reasoning");

  const shouldRenderUserAvatar = showUserAvatar && message.role === "user";
  const hasRenderableContent =
    textParts.length > 0 || fileParts.length > 0 || reasoningParts.length > 0;

  const shouldRenderMessageBody = textParts.length > 0 || shouldRenderUserAvatar;
  const shouldReserveUserAvatarSpace = shouldRenderUserAvatar && textParts.length > 0;

  if (!hasRenderableContent && !shouldRenderUserAvatar) return null;

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
          attachments={message.attachments}
          role={message.role}
          messageId={message._id}
          className={cn(
            shouldRenderUserAvatar && "self-end",
            shouldReserveUserAvatarSpace && "max-w-[calc(100%-3.25rem)]",
            isMobile && shouldRenderUserAvatar && "mr-13",
          )}
        />

        {shouldRenderMessageBody && (
          <div
            className={cn("relative flex items-start gap-2", {
              "w-full": message.role === "assistant",
              "max-w-full justify-end self-end": message.role === "user",
            })}
          >
            {textParts.length > 0 && (
              <div
                className={cn("flex min-w-0 flex-col gap-2", {
                  "w-full": message.role === "assistant",
                  "max-w-[calc(100%-3.25rem)]": shouldReserveUserAvatarSpace,
                })}
              >
                {textParts.map((part, i) => (
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
              <MessageAvatar className={cn("shrink-0", textParts.length === 0 && "self-start")} />
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
