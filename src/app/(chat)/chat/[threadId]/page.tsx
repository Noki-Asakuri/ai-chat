"use client";

import { ChatMessages } from "@/components/message";
import { ChatTextarea } from "@/components/chat-textarea";

export default function Page() {
  return (
    <div className="grid h-svh max-w-screen grid-cols-1">
      <div className="border-border border-r"></div>

      <div className="relative flex h-svh flex-col">
        <ChatMessages />
        <ChatTextarea />
      </div>
    </div>
  );
}
