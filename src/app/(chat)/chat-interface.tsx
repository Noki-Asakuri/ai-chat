"use client";

import { ChatTextarea } from "@/components/chat-textarea";
import { ChatMessages } from "@/components/message";

export function ChatInterface() {
  return (
    <div className="border-border relative mt-3 flex h-[calc(100vh-12px)] flex-col rounded-tl-2xl border-t border-l pt-6">
      <ChatMessages />
      <ChatTextarea />
    </div>
  );
}
