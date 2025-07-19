import { PencilIcon, SaveIcon, SplitIcon, XIcon } from "lucide-react";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "../ui/button";
import { MessageRetryMenu } from "./message-retry-menu";

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

  const { retryMessage, branchOffThreadMessage } = useChatRequest();

  async function handleEditMessage() {
    if (message.role === "assistant") return;
    if (editMessage?._id === message._id) {
      setEditMessage(null);
      if (editMessage.content !== message.content) {
        await retryMessage(index, {
          editedUserMessage: { _id: editMessage._id, content: editMessage.content },
        });
      }
      return;
    }

    setEditMessage({ _id: message._id, content: message.content });
  }

  return (
    <div className="bg-background/80 flex items-center gap-0.5 rounded-md border p-1 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-0">
      <CopyButton className="size-8" side="bottom" content={message.content} />

      {message.role === "assistant" && (
        <ButtonWithTip
          variant="ghost"
          side="bottom"
          className="size-8"
          onMouseDown={() => branchOffThreadMessage(message)}
          title="Branch off at this message"
          disabled={message.status === "pending" || message.status === "streaming"}
        >
          <SplitIcon className="size-5 rotate-180" />
        </ButtonWithTip>
      )}

      {message.role === "user" && (
        <>
          <ButtonWithTip
            variant="ghost"
            side="bottom"
            disabled={message.status === "pending"}
            onMouseDown={() => setEditMessage(null)}
            className={cn("hidden size-8", { flex: editMessage?._id === message._id })}
            title="Cancel Edit"
          >
            <XIcon className="size-5" />
            <span className="sr-only">Cancel Edit</span>
          </ButtonWithTip>

          <ButtonWithTip
            variant="ghost"
            side="bottom"
            className="size-8"
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

      <MessageRetryMenu index={index} message={message} className="size-8" />
    </div>
  );
}
