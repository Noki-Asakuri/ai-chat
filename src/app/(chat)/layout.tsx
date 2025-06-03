"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { ThreadList } from "@/components/thread-list";

import { processChatStream } from "@/lib/chat/process-stream";
import { chatStore, useChatStore, type ChatState } from "@/lib/chat/store";

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ threadId?: string }>();
  const threadId = useChatStore((state) => state.threadId);
  const newThreadId = useChatStore((state) => state.newThreadId);

  const resumeRef = useRef<boolean>(false);

  const data = useQuery(api.messages.getAllMessagesFromThread, { threadId });

  useEffect(() => {
    if (!threadId || threadId !== params.threadId) {
      console.log("[Thread] Setting thread id");
      chatStore.getState().setThreadId(params.threadId ?? newThreadId);
    }
  }, [params.threadId, newThreadId]);

  useEffect(() => {
    if (!data) return;

    console.debug("[Convex] Syncing messages from Convex", { threadId, data });
    const lastMessage = data.at(-1);

    const state = chatStore.getState();
    state.setDataFromConvex(data, lastMessage?.status ?? "complete", threadId);

    if (
      lastMessage?.resumableStreamId &&
      lastMessage.status === "streaming" &&
      !state.isStreaming &&
      !resumeRef.current
    ) {
      resumeRef.current = true;
      console.debug("[Convex] Resuming chat streaming", { threadId });
      void resumeStreaming(state, lastMessage.resumableStreamId, lastMessage._id);
      resumeRef.current = false;
    }
  }, [data]);

  return (
    <div className="grid h-svh max-w-screen overflow-x-hidden lg:grid-cols-[280px_1fr]">
      <ThreadList />

      {children}
    </div>
  );
}

async function resumeStreaming(state: ChatState, streamId: string, assistantMessageId: string) {
  let content = "";
  let reasoning = "";

  state.setIsStreaming(true);

  const response = fetch("/api/ai/chat?streamId=" + streamId);
  await processChatStream(response, async (stream) => {
    switch (stream.type) {
      case "text-delta":
        content += stream.data;
        break;

      case "reasoning":
        reasoning += stream.data;
        break;

      case "custom-json":
        console.log(stream.data);
        break;

      case "finish":
        state.setStatus("complete");
        break;
    }

    state.setAssistantMessage({ id: assistantMessageId, content, reasoning });
  });

  state.setIsStreaming(false);
}
