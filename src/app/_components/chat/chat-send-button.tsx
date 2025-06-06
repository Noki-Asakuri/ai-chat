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
      title={isStreaming ? "Abort Request" : "Send Message"}
      onMouseDown={(event) => (isStreaming ? abortChatRequest() : submitChatMessage(event, router))}
      className="border-primary bg-primary/30 size-9 cursor-pointer rounded-b-none border border-b-0"
    >
      {isStreaming ? <SquareIcon className="size-4" /> : <SendHorizontalIcon className="size-4 -rotate-45" />}
    </ButtonWithTip>
  );
}
