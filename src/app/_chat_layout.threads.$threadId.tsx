import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Suspense, useEffect, useEffectEvent } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { LoadingSkeleton } from "@/components/chat/loading-skeleton";
import { MessageHistory } from "@/components/message/message-history";
import { useConfigStoreState } from "@/components/provider/config-provider";

import { useAutoResumeStream } from "@/lib/chat/server-function/auto-resume-stream";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { messageStoreActions } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";
import { fromUUID } from "@/lib/utils";

export const Route = createFileRoute("/_chat_layout/threads/$threadId")({
  component: ChatComponentPage,
  loader: async ({ context, params }) => {
    void context.queryClient.prefetchQuery(
      convexQuery(api.functions.messages.getAllMessagesFromThread, {
        threadId: fromUUID<Id<"threads">>(params.threadId),
        sessionId: context.sessionId,
      }),
    );
  },
});

function ChatComponentPage() {
  const params = Route.useParams();

  useEffect(() => {
    messageStoreActions.setCurrentThreadId(fromUUID<Id<"threads">>(params.threadId));
  }, [params.threadId]);

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ChatHistory />
      <ChatTextarea key="main-chat-textarea" />
    </Suspense>
  );
}

function ChatHistory() {
  const params = useParams({ from: "/_chat_layout/threads/$threadId" });
  const threadId = fromUUID<Id<"threads">>(params.threadId);
  const { autoResumeStream } = useAutoResumeStream();
  const configStore = useConfigStoreState();

  const { data, dataUpdatedAt } = useSuspenseQuery({
    ...convexSessionQuery(api.functions.messages.getAllMessagesFromThread, { threadId }),
    retry(failureCount, error) {
      const ignoreErrors = ["Thread not found", "Not authorized", "Not authenticated"];
      return ignoreErrors.some((e) => error.message.includes(e)) ? false : failureCount < 3;
    },
  });

  const syncMessage = useEffectEvent((messages: ChatMessage[], syncToken: number) => {
    messageStoreActions.syncMessages(threadId, messages, syncToken);

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (lastMessage.metadata) {
      configStore.setConfig({
        model: lastMessage.metadata.model.request,
        ...lastMessage.metadata.modelParams,
      });
    }

    if (lastMessage.status === "streaming" && lastMessage.resumableStreamId) {
      void autoResumeStream(lastMessage.resumableStreamId, lastMessage._id);
    }

    // Clear any active controller if the stream has completed or errored
    if (lastMessage.status === "complete" || lastMessage.status === "error") {
      messageStoreActions.removeController(lastMessage.threadId);
    }

    // Auto scroll to bottom when new messages are added (only if user is already at bottom)
    window.dispatchEvent(new Event("chat:scroll-if-sticky"));
  });

  useEffect(() => {
    if (data) syncMessage(data.messages, dataUpdatedAt);
  }, [data, dataUpdatedAt]);

  return <MessageHistory />;
}
