"use client";
import { api } from "@/convex/_generated/api";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { chatStore, type ChatState } from "@/lib/chat/store";
import { getConvexClient } from "@/lib/convex/client";
import { processChatStream } from "@/lib/chat/process-stream";

const convexClient = getConvexClient();

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ threadId?: string }>();
  const threadId = params.threadId ?? crypto.randomUUID();

  const unsubRef = useRef<ReturnType<typeof convexClient.onUpdate>>(null);
  const resumeRef = useRef<boolean>(false);

  useEffect(() => {
    unsubRef.current ??= convexClient.onUpdate(api.messages.getAllMessagesFromThread, { threadId }, (data) => {
      console.debug("[Convex] Syncing messages from Convex");
      const lastMessage = data.at(-1);

      const state = chatStore.getState();
      state.setDataFromConvex(data, lastMessage?.status, threadId);

      if (
        lastMessage?.status === "streaming" &&
        lastMessage?.resumableStreamId &&
        !state.localStreaming &&
        !state.isResuming &&
        !resumeRef.current
      ) {
        resumeRef.current = true;

        console.log("[Convex] Resuming streaming");
        void resumeStreaming(state, lastMessage.resumableStreamId, lastMessage._id);
      }
    });

    return () => {
      if (unsubRef.current) unsubRef.current.unsubscribe();
    };
  }, [threadId]);

  return children;
}

async function resumeStreaming(state: ChatState, streamId: string, assistantMessageId: string) {
  state.setIsResuming(true);
  state.setLocalStreaming(true);

  const res = await fetch("/api/ai/chat?streamId=" + streamId);

  let content = "";
  let reasoning = "";

  await processChatStream(res.body!, async (stream) => {
    switch (stream.type) {
      case "text-delta":
        content += stream.data.replaceAll("\\n", "\n");
        break;

      case "reasoning":
        reasoning += stream.data.replaceAll("\\n", "\n");
        break;

      case "custom-json":
        console.log(stream.data);
        break;

      case "finish":
        chatStore.getState().setStatus("complete");
        break;
    }

    state.setAssistantMessage({ id: assistantMessageId, content, reasoning });
  });

  state.setLocalStreaming(false);
  state.setIsResuming(false);
}
