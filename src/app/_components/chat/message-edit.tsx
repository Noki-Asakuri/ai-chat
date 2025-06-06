import type { Id } from "@/convex/_generated/dataModel";

import { useState } from "react";

import { Textarea } from "../ui/textarea";

import { retryMessage } from "@/lib/chat/retry-message";
import { useChatStore } from "@/lib/chat/store";

export function MessageEdit({ id, content, index }: { id: Id<"messages">; content: string; index: number }) {
  const [editedUserMessage, setEditedUserMessage] = useState<string>(content);
  const setEditMessageId = useChatStore((state) => state.setEditMessageId);

  return (
    <Textarea
      rows={3}
      name="user-input"
      defaultValue={editedUserMessage}
      onChange={(event) => setEditedUserMessage(event.target.value)}
      className="min-h-11 w-full min-w-[80ch] resize-none px-4 py-2 font-sans outline-none"
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          void retryMessage(index, { _id: id, content: editedUserMessage });
          setEditMessageId(null);
        }
      }}
    />
  );
}
