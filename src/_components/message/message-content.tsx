import { Message } from "../ui/ai-elements/message";

import { MessageAttachmentsDisplay } from "./message-attachments-display";
import {
  getMessageIdentity,
  MessageIdentityAvatar,
  MessageIdentityHeader,
} from "./message-identity";
import { StreamDownWrapper } from "./message-markdown";
import { MessageMetadata } from "./message-metadata";
import { MessageReasoning } from "./message-reasoning";

import type { ChatMessage, MessageUserIdentity } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageContentProps = {
  message: ChatMessage;
  userIdentity: MessageUserIdentity;
};

export function MessageContent({ message, userIdentity }: MessageContentProps) {
  const parts = message.parts ?? [];
  const identity = getMessageIdentity(message, userIdentity);

  if (message.status === "error") {
    const error = message.error?.length
      ? message.error
      : "An error have occurred. Please try again.";

    return <MessageError identity={identity} message={error} role={message.role} />;
  }

  const textParts = parts.filter((part) => part.type === "text");
  const fileParts = parts.filter((part) => part.type === "file");
  const reasoningParts = parts.filter((part) => part.type === "reasoning");

  return (
    <Message from={message.role}>
      <div className="flex h-full shrink-0 flex-col items-center justify-between gap-2 pt-0.5">
        <MessageIdentityAvatar identity={identity} />
        <MessageMetadata metadata={message.metadata} />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <MessageIdentityHeader identity={identity} />

        <MessageReasoning
          parts={reasoningParts}
          status={message.status}
          metadata={message.metadata}
          className="w-full"
        />

        {textParts.length > 0 && (
          <div className="flex min-w-0 flex-col gap-3">
            {textParts.map((part, index) => (
              <div
                key={`${message._id}-${index}`}
                className={cn("w-full", message.role === "assistant" && "text-foreground")}
              >
                <StreamDownWrapper
                  isAnimating={part.state === "streaming"}
                  role={message.role}
                  className={message.role === "user" ? "whitespace-pre-wrap" : undefined}
                >
                  {part.text}
                </StreamDownWrapper>
              </div>
            ))}
          </div>
        )}

        {fileParts.length > 0 && (
          <MessageAttachmentsDisplay
            parts={fileParts}
            role={message.role}
            messageId={message._id}
            className="w-full"
          />
        )}
      </div>
    </Message>
  );
}

function MessageError({
  identity,
  message,
  role,
}: {
  identity: ReturnType<typeof getMessageIdentity>;
  message: string;
  role: ChatMessage["role"];
}) {
  return (
    <Message from={role}>
      <div className="flex shrink-0 pt-0.5">
        <MessageIdentityAvatar identity={identity} />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <MessageIdentityHeader identity={identity} />

        <div
          data-slot="message-error"
          className="max-w-3xl rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive backdrop-blur-md backdrop-saturate-150"
        >
          <StreamDownWrapper role={role} isAnimating={false}>
            {message}
          </StreamDownWrapper>
        </div>
      </div>
    </Message>
  );
}
