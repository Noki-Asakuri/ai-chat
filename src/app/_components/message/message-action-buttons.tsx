import { PencilIcon, RefreshCcwIcon, SaveIcon, SplitIcon, XIcon } from "lucide-react";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "../ui/button";

import { handleBranchOff } from "@/lib/chat/action-branch-off";
import { useChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageActionButtonsProps = {
  index: number;
  message: ChatMessage;
};

export function MessageActionButtons({ index, message }: MessageActionButtonsProps) {
  const setEditMessage = useChatStore((state) => state.setEditMessage);
  const editMessage = useChatStore((state) => state.editMessage);

  const { retryMessage } = useChatRequest();

  async function handleEditMessage() {
    if (message.role === "assistant") return;
    if (editMessage?._id === message._id) {
      setEditMessage(null);
      if (editMessage.content !== message.content) {
        await retryMessage(index, { _id: editMessage._id, content: editMessage.content });
      }
      return;
    }

    setEditMessage({ _id: message._id, content: message.content });
  }

  return (
    <div className="flex grow-0 items-center gap-0.5">
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
          onMouseDown={() => handleBranchOff(message, navigate)}
          title="Branch Off"
          disabled={message.status === "pending" || message.status === "streaming"}
        >
          <SplitIcon className="size-5 rotate-180" />
        </ButtonWithTip>
      )}

      {message.role === "user" && (
        <>
          <ButtonWithTip
            variant="ghost"
            title="Cancel Edit"
            disabled={message.status === "pending"}
            onMouseDown={() => setEditMessage(null)}
            className={cn("hidden size-10", { flex: editMessage?._id === message._id })}
          >
            <XIcon className="size-5" />
            <span className="sr-only">Cancel Edit</span>
          </ButtonWithTip>

          <ButtonWithTip
            variant="ghost"
            className="size-10"
            onMouseDown={handleEditMessage}
            disabled={message.status === "pending"}
            title={editMessage?._id === message._id ? "Save Message" : "Edit Message"}
          >
            {editMessage?._id === message._id ? (
              <SaveIcon className="size-5" />
            ) : (
              <PencilIcon className="size-5" />
            )}
            <span className="sr-only">
              {editMessage?._id === message._id ? "Save Message" : "Edit Message"}
            </span>
          </ButtonWithTip>
        </>
      )}

      <CopyButton className="size-10" content={message.content} />
    </div>
  );
}
