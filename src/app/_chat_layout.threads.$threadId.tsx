import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useParams } from "@tanstack/react-router";
import { Suspense } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { MessageHistory } from "@/components/message/message-history";
import { ChatProvider } from "@/components/provider/chat-provider";

import { convexSessionQuery } from "@/lib/convex/helpers";
import type { ChatMessage, UIChatMessage } from "@/lib/types";
import { fromUUID } from "@/lib/utils";

export const Route = createFileRoute("/_chat_layout/threads/$threadId")({
  preload: false,
  component: ChatComponentPage,

  errorComponent: () => {
    return <Navigate to="/" />;
  },
});

function convertToUIChatMessage(message: ChatMessage): UIChatMessage {
  const transformedMessage: UIChatMessage = {
    id: message.messageId,
    role: message.role,
    parts: message.parts as UIChatMessage["parts"],
  };

  if (message.metadata) {
    message.metadata = {
      durations: message.metadata.durations,
      usages: message.metadata.usages,
      timeToFirstTokenMs: message.metadata.timeToFirstTokenMs,
      finishReason: message.metadata.finishReason,
      model: message.metadata.model,

      profile: message.metadata.profile
        ? { id: message.metadata.profile.id, name: message.metadata.profile.name }
        : undefined,
    };
  }

  return transformedMessage;
}

function ChatComponentPage() {
  return (
    <ChatProvider>
      <Suspense>
        <ChatHistory />
      </Suspense>

      <ChatTextarea key="main-chat-textarea" />
    </ChatProvider>
  );
}

function ChatHistory() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });
  const threadId = fromUUID<Id<"threads">>(params.threadId);

  const { data } = useSuspenseQuery({
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, { threadId }),
    retry(failureCount, error) {
      const ignoreErrors = ["Thread not found", "Not authorized", "Not authenticated"];
      return ignoreErrors.some((e) => error.message.includes(e)) ? false : failureCount < 3;
    },
  });

  return <MessageHistory />;
}
