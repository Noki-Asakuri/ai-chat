import { createFileRoute } from "@tanstack/react-router";

import { Chat } from "@/components/chat/chat-render";

export const Route = createFileRoute("/_chat_layout/threads/$threadId")({
  preload: false,
  ssr: "data-only",
  component: Chat,
});
