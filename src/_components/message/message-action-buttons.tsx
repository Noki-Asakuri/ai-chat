import type { Id } from "@/convex/_generated/dataModel";

import { BugPlayIcon, SplitIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { CopyButton } from "../copy-button";
import { ButtonWithTip } from "../ui/button";
import { MessageRetryMenu } from "./message-retry-menu";

import { useBranchThread } from "@/lib/chat/server-function/branch-thread";
import { useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage } from "@/lib/types";

type MessageActionButtonsProps = {
  index: number;
  isFinished: boolean;
  message: ChatMessage;
};

export function MessageActionButtons({ index, isFinished, message }: MessageActionButtonsProps) {
  const { branchThread } = useBranchThread();

  const content = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

  // async function handleEditMessage() {
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
  // }

  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background/80 p-1 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:border-0">
      {isFinished && (
        <>
          <CopyButton
            side="bottom"
            className="size-8"
            content={message.status === "error" ? message.error || "" : content}
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
        </>
      )}

      <DebugButton messageId={message._id} />
    </div>
  );
}

function DebugButton({ messageId }: { messageId: Id<"messages"> }) {
  const message = useMessageStore(useShallow((state) => state.messagesById[messageId]!));

  if (import.meta.env.PROD) return null;

  return (
    <ButtonWithTip
      variant="ghost"
      side="bottom"
      className="size-8"
      title="Debug"
      onClick={() => console.log(message)}
    >
      <BugPlayIcon className="size-4" />
      <span className="sr-only">Debug</span>
    </ButtonWithTip>
  );
}
