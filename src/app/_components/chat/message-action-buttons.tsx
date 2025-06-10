import { PencilIcon, RefreshCcwIcon, SaveIcon, SplitIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { ButtonWithTip } from "../ui/button";
import { CopyButton } from "./copy-button";

import { handleBranchOff } from "@/lib/chat/action-branch-off";
import { retryMessage } from "@/lib/chat/retry-message";
import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";

type MessageActionButtonsProps = {
  index: number;
  message: ChatMessage;
};

export function MessageActionButtons({ index, message }: MessageActionButtonsProps) {
  const setEditMessageId = useChatStore((state) => state.setEditMessageId);
  const editMessageId = useChatStore((state) => state.editMessageId);

  const router = useRouter();

  function handleEditMessage() {
    if (message.role === "assistant") return;
    setEditMessageId(editMessageId === message._id ? null : message._id);
  }

  return (
    <div className="flex items-center gap-0.5">
      <ButtonWithTip
        variant="ghost"
        className="size-10"
        onMouseDown={() => retryMessage(index)}
        title="Retry Message"
        disabled={message.status === "pending"}
      >
        <RefreshCcwIcon className="size-5" />
      </ButtonWithTip>

      {message.role === "assistant" && (
        <ButtonWithTip
          variant="ghost"
          className="size-10"
          onMouseDown={() => handleBranchOff(message, router)}
          title="Branch Off"
          disabled={message.status === "pending" || message.status === "streaming"}
        >
          <SplitIcon className="size-5 rotate-180" />
        </ButtonWithTip>
      )}

      {message.role === "user" && (
        <ButtonWithTip
          variant="ghost"
          className="size-10"
          onMouseDown={handleEditMessage}
          title="Edit Message"
          disabled={message.status === "pending"}
        >
          {editMessageId === message._id ? (
            <SaveIcon className="size-5" />
          ) : (
            <PencilIcon className="size-5" />
          )}
        </ButtonWithTip>
      )}

      <CopyButton className="size-10" content={message.content} />
    </div>
  );
}
