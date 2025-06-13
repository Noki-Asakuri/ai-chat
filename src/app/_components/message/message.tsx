import { Loader2Icon } from "lucide-react";

import { WelcomeScreen } from "../welcome-screen";

import { MessageContent } from "./message-content";
import { MessageEdit } from "./message-edit";
import { MessageFooter } from "./message-footer";
import { ThinkingToggle } from "./message-thinking";
import { UserAvatar } from "./user-avatar";

import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessageHistory } from "./message-history";

export function ChatMessages() {
  return (
    <>
      <WelcomeScreen />
      <MessageHistory />
    </>
  );
}

export function Message({
  message,
  index,
  isLast,
}: {
  message: ChatMessage;
  index: number;
  isLast: boolean;
}) {
  const assistantMessage = useChatStore((state) => state.assistantMessage);
  const editMessage = useChatStore((state) => state.editMessage);

  const renderMessage =
    message.role === "assistant" &&
    assistantMessage?.id === message._id &&
    message.status === "streaming"
      ? assistantMessage
      : message;

  return (
    <div
      className={cn(
        "group mx-auto flex max-w-[calc(896px+32px)] items-start gap-2 px-4",
        "[&:not(:first-child)]:mt-14 [&[data-streaming='false']:last-child]:mb-14",
      )}
      id={message.messageId}
      data-role={message.role}
      data-status={message.status}
      data-index={index}
      data-streaming={message.status === "streaming" || message.status === "pending"}
      data-is-last={isLast}
    >
      {message.role === "assistant" &&
        message.status !== "error" &&
        (message.status === "pending" || (!renderMessage.content && !renderMessage.reasoning)) && (
          <div className="flex h-11 shrink-0 items-center">
            <Loader2Icon className="size-6 animate-spin" />
          </div>
        )}

      <div
        className={cn("relative flex w-full flex-col", {
          hidden: message.status === "pending",
          "mx-0 ml-auto w-auto gap-1": message.role === "user",
        })}
      >
        <ThinkingToggle
          messageId={message.messageId}
          finished={renderMessage.content.length > 0}
          reasoning={renderMessage.reasoning}
          status={message.status}
          tokens={renderMessage.metadata?.thinkingTokens}
        />

        {message.role === "user" && editMessage?._id === message._id ? (
          <MessageEdit content={message.content} index={index} id={message._id} />
        ) : (
          <MessageContent content={renderMessage.content} message={message} />
        )}

        <MessageFooter message={message} index={index} renderMessage={renderMessage} />
      </div>

      {message.role === "user" && <UserAvatar />}
    </div>
  );
}
