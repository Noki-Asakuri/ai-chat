import { api } from "@/convex/_generated/api";

import { SendHorizontalIcon, SquareIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { ButtonWithTip } from "../ui/button";

import { abortChatRequest, submitChatMessage } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";

export function ChatSendButton() {
  const router = useRouter();
  const isStreaming = useChatStore((state) => state.isStreaming);

  return (
    <ButtonWithTip
      type="button"
      variant="secondary"
      title={isStreaming ? "Abort Request" : "Send Message"}
      onMouseDown={() => (isStreaming ? abortChatRequest() : submitChatMessage({ router }))}
      className="hover:border-primary hover:bg-primary/40 size-9 border transition-colors"
    >
      {isStreaming ? <SquareIcon /> : <SendHorizontalIcon className="-rotate-45" />}
    </ButtonWithTip>
  );
}
