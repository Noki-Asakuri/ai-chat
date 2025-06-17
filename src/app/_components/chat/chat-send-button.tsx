import { SendHorizontalIcon, SquareIcon } from "lucide-react";
import { useNavigate } from "react-router";

import { ButtonWithTip } from "../ui/button";

import { abortChatRequest, submitChatMessage } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";

export function ChatSendButton() {
  const navigate = useNavigate();
  const isStreaming = useChatStore((state) => state.isStreaming);

  return (
    <ButtonWithTip
      type="button"
      variant="secondary"
      title={isStreaming ? "Abort Request" : "Send Message"}
      onMouseDown={() => (isStreaming ? abortChatRequest() : submitChatMessage({ navigate }))}
      className="hover:border-primary hover:bg-primary/40 size-9 border transition-colors"
    >
      {isStreaming ? <SquareIcon /> : <SendHorizontalIcon className="-rotate-45" />}
      <span className="sr-only">{isStreaming ? "Abort Request" : "Send Message"}</span>
    </ButtonWithTip>
  );
}
