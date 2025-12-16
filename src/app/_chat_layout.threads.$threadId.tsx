import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, useParams } from "@tanstack/react-router";
import { Suspense, useEffect, useEffectEvent } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { MessageHistory } from "@/components/message/message-history";
import { useConfigStoreState } from "@/components/provider/config-provider";

import { useAutoResumeStream } from "@/lib/chat/server-function/auto-resume-stream";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { messageStoreActions } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";
import { fromUUID } from "@/lib/utils";

export const Route = createFileRoute("/_chat_layout/threads/$threadId")({
  preload: false,
  component: ChatComponentPage,

  errorComponent: (err) => {
    console.error("ChatComponentPage Error:", err);
    return <Navigate to="/" />;
  },
});

function ChatComponentPage() {
  const params = Route.useParams();

  useEffect(() => {
    messageStoreActions.setCurrentThreadId(fromUUID<Id<"threads">>(params.threadId));
  }, [params.threadId]);

  return (
    <>
      <Suspense>
        <ChatHistory />
      </Suspense>

      <ChatTextarea key="main-chat-textarea" />
    </>
  );
}

function ChatHistory() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });
  const threadId = fromUUID<Id<"threads">>(params.threadId);
  const { autoResumeStream } = useAutoResumeStream();
  const configStore = useConfigStoreState();

  const { data } = useSuspenseQuery({
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, { threadId }),
    retry(failureCount, error) {
      const ignoreErrors = ["Thread not found", "Not authorized", "Not authenticated"];
      return ignoreErrors.some((e) => error.message.includes(e)) ? false : failureCount < 3;
    },
  });

  const syncMessage = useEffectEvent((data: ChatMessage[]) => {
    messageStoreActions.syncMessages(data);

    const lastMessage = data[data.length - 1];
    if (!lastMessage) return;

    if (lastMessage.metadata) {
      configStore.setConfig({
        model: lastMessage.metadata.model.request,
        ...lastMessage.metadata.modelParams,
      });
    }

    if (lastMessage.status === "streaming" && lastMessage.resumableStreamId) {
      return autoResumeStream(lastMessage.resumableStreamId, lastMessage._id);
    }
  });

  useEffect(() => {
    if (data) syncMessage(data.messages);
  }, [data]);

  return <MessageHistory />;
}
