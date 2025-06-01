"use client";
import { api } from "@/convex/_generated/api";

import { useParams } from "next/navigation";
import { useEffect, useRef, useLayoutEffect } from "react";

import { v4 as uuidv4 } from "uuid";

import { chatStore, useChatStore, type ChatState } from "@/lib/chat/store";
import { getConvexClient } from "@/lib/convex/client";
import { processChatStream } from "@/lib/chat/process-stream";

const convexClient = getConvexClient();

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ threadId?: string }>();
  const threadId = useChatStore((state) => state.threadId);

  const unsubRef = useRef<ReturnType<typeof convexClient.onUpdate>>(null);
  const resumeRef = useRef<boolean>(false);

  useLayoutEffect(() => {
    if (!threadId) {
      console.log("[Thread] Setting thread id");

      const threadId = params.threadId ?? uuidv4();
      chatStore.getState().setThreadId(threadId);
    }
  }, []);

  useEffect(() => {
    console.log("Ran?");

    unsubRef.current ??= convexClient.onUpdate(api.messages.getAllMessagesFromThread, { threadId }, (data) => {
      console.debug("[Convex] Syncing messages from Convex", { threadId, data });
      const lastMessage = data.at(-1);

      const state = chatStore.getState();
      state.setDataFromConvex(data, lastMessage?.status, threadId);

      if (lastMessage?.resumableStreamId && !state.localStreaming && !state.isResuming && !resumeRef.current) {
        resumeRef.current = true;
        console.log("[Convex] Resuming streaming from Convex");
        void resumeStreaming(state, lastMessage.resumableStreamId, lastMessage._id);
        resumeRef.current = false;
      }
    });

    return () => {
      if (unsubRef.current) {
        console.log("[Convex] Unsubscribing from Convex");
        unsubRef.current.unsubscribe();
        unsubRef.current = null;
      }
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
