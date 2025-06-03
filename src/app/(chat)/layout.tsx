"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

import { ThreadList } from "@/components/thread-list";

import { processChatStream } from "@/lib/chat/process-stream";
import { chatStore, useChatStore, type ChatState } from "@/lib/chat/store";
import { fromUUID } from "@/lib/utils";

const ChatTextarea = dynamic(() => import("@/components/chat-textarea").then((d) => d.ChatTextarea), { ssr: false });

export default function Layout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ threadId?: string }>();
  const threadId = useChatStore((state) => state.threadId);

  const resumeRef = useRef<boolean>(false);
  const setThreadId = useChatStore((state) => state.setThreadId);

  const data = useQuery(api.messages.getAllMessagesFromThread, { threadId: fromUUID(threadId) as Id<"threads"> });

  useEffect(() => {
    if (threadId !== params.threadId) {
      console.debug("[Thread] Setting thread id", params.threadId);
      setThreadId(fromUUID(params.threadId) as Id<"threads">);
    }
  }, [params.threadId, setThreadId, threadId]);

  useEffect(() => {
    const state = chatStore.getState();
    if (!data?.length) return state.setMessages([]);

    const lastMessage = data.at(-1)!;
    const threadId = lastMessage.threadId;

    console.debug("[Convex] Syncing messages from Convex", { data, threadId });
    state.setDataFromConvex(data, lastMessage.status ?? "complete", lastMessage.threadId);

    if (
      lastMessage?.resumableStreamId &&
      lastMessage.status === "streaming" &&
      !state.isStreaming &&
      !resumeRef.current
    ) {
      resumeRef.current = true;
      console.debug("[Convex] Resuming chat streaming", { threadId, streamId: lastMessage.resumableStreamId });
      void resumeStreaming(state, lastMessage.resumableStreamId, lastMessage._id);
      resumeRef.current = false;
    }
  }, [data]);

  return (
    <div className="grid h-svh max-w-screen overflow-x-hidden lg:grid-cols-[280px_1fr]">
      <ThreadList />

      <div className="border-border relative mt-3 flex h-[calc(100vh-12px)] flex-col rounded-tl-2xl border-t border-l pt-6">
        {children}
        <ChatTextarea />
      </div>
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
