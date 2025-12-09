import { createFileRoute } from "@tanstack/react-router";

import { ChatHistory } from "@/components/chat/chat-history";

export const Route = createFileRoute("/_chat_layout/threads/$threadId")({
  preload: false,
  component: ChatHistory,
});
