import { ChatMessages } from "@/components/message";
import { ChatTextarea } from "@/components/chat-textarea";
import { ThreadList } from "@/components/thread-list";

export function ChatInterface() {
  return (
    <div className="grid h-svh max-w-screen grid-cols-[280px_1fr] overflow-x-hidden">
      <ThreadList />

      <div className="border-border relative mt-3 flex h-[calc(100vh-12px)] flex-col rounded-tl-2xl border-t border-l pt-6">
        <ChatMessages />
        <ChatTextarea />
      </div>
    </div>
  );
}
