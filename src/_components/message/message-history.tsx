import { Message } from "./message";

import { useChatStore } from "@/lib/store/chat-store";
import { useMessageStore } from "@/lib/store/messages-store";

export function MessageHistory() {
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  return (
    <div
      id="messages-scrollarea"
      className="custom-scroll absolute inset-0 overflow-y-scroll"
      style={{ scrollbarGutter: "stable both-edges" }}
    >
      <div
        data-slot="message-history"
        className="mx-auto min-h-full max-w-[calc(56rem+32px)] space-y-4 px-4 pt-12"
        style={{ paddingBottom: `${textareaHeight}px` }}
      >
        <Messages />
      </div>
    </div>
  );
}

function Messages() {
  const messages = useMessageStore((state) => state.messageIds);

  return messages.map((messageId, index) => (
    <Message key={messageId} messageId={messageId} index={index} total={messages.length} />
  ));
}
