import type { Id } from "@/convex/_generated/dataModel";

import { PencilIcon, RefreshCcwIcon, SaveIcon } from "lucide-react";

import { ButtonWithTip } from "../ui/button";
import { CopyButton } from "./copy-button";

import { retryMessage } from "@/lib/chat/retry-message";
import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";

type MessageActionButtonsProps = {
  id: Id<"messages">;
  index: number;
  content: string;
  role: ChatMessage["role"];
  status: ChatMessage["status"];
};

export function MessageActionButtons({
  role,
  status,
  index,
  id,
  content,
}: MessageActionButtonsProps) {
  const setEditMessageId = useChatStore((state) => state.setEditMessageId);
  const editMessageId = useChatStore((state) => state.editMessageId);

  function handleEditMessage() {
    if (role === "assistant") return;
    setEditMessageId(editMessageId === id ? null : id);
  }

  return (
    <div className="flex items-center gap-0.5">
      <ButtonWithTip
        variant="ghost"
        className="size-10"
        onMouseDown={() => retryMessage(index)}
        title="Retry Message"
        disabled={status === "pending"}
      >
        <RefreshCcwIcon className="size-5" />
      </ButtonWithTip>

      {role === "user" && (
        <ButtonWithTip
          variant="ghost"
          className="size-10"
          onMouseDown={handleEditMessage}
          title="Edit Message"
          disabled={status === "pending"}
        >
          {editMessageId === id ? (
            <SaveIcon className="size-5" />
          ) : (
            <PencilIcon className="size-5" />
          )}
        </ButtonWithTip>
      )}

      <CopyButton className="size-10" content={content} />
    </div>
  );
}
