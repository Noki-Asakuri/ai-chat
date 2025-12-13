import { SplitIcon } from "lucide-react";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "../ui/button";
import { MessageRetryMenu } from "./message-retry-menu";

import { useBranchThread } from "@/lib/chat/server-function/branch-thread";
import type { ChatMessage } from "@/lib/types";

type MessageActionButtonsProps = {
  index: number;
  message: ChatMessage;
};

export function MessageActionButtons({ index, message }: MessageActionButtonsProps) {
  const { branchThread } = useBranchThread();

  async function handleEditMessage() {
    // if (message.role === "assistant") return;
    // if (editMessage?._id === message._id) {
    //   useChatStore.getState().setEditMessage(null);
    //   if (editMessage.content !== message.content) {
    //     // await retryMessage(index, {
    //     //   editedUserMessage: { _id: editMessage._id, content: editMessage.content },
    //     // });
    //   }
    //   return;
    // }
    // useChatStore.getState().setEditMessage({ _id: message._id, content: message.content });
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background/80 p-1 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-0">
      <CopyButton
        className="size-8"
        side="bottom"
        content={
          message.status === "error"
            ? message.error || ""
            : message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("\n\n")
        }
      />

      {message.role === "assistant" && (
        <ButtonWithTip
          variant="ghost"
          side="bottom"
          className="size-8"
          onMouseDown={() => branchThread(message._id)}
          title="Branch off at this message"
          disabled={message.status === "pending" || message.status === "streaming"}
        >
          <SplitIcon className="size-4 rotate-180" />
        </ButtonWithTip>
      )}

      <MessageRetryMenu index={index} message={message} className="size-8" />
    </div>
  );
}
