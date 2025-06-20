import { SendHorizontalIcon, SquareIcon } from "lucide-react";

import { ButtonWithTip } from "../ui/button";

import { useChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";

export function ChatSendButton() {
  const isStreaming = useChatStore((state) => state.isStreaming);
  const { submitChatMessage, abortChatRequest } = useChatRequest();

  return (
    <ButtonWithTip
      type="button"
      variant="secondary"
      title={isStreaming ? "Abort Request" : "Send Message"}
      onMouseDown={() => (isStreaming ? abortChatRequest() : submitChatMessage())}
      className="hover:border-primary hover:bg-primary/40 size-9 border transition-colors"
    >
      {isStreaming ? <SquareIcon /> : <SendHorizontalIcon className="-rotate-45" />}
      <span className="sr-only">{isStreaming ? "Abort Request" : "Send Message"}</span>
    </ButtonWithTip>
  );
}
