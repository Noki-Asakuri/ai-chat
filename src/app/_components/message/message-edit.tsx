import type { Id } from "@/convex/_generated/dataModel";

import { Textarea } from "../ui/textarea";

import { useChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";

type MessageEditProps = {
  id: Id<"messages">;
  content: string;
  index: number;
};

export function MessageEdit({ id, content, index }: MessageEditProps) {
  const editedUserMessage = useChatStore((state) => state.editMessage);
  const setEditMessage = useChatStore((state) => state.setEditMessage);

  const { retryMessage } = useChatRequest();

  return (
    <Textarea
      rows={3}
      name="user-input"
      defaultValue={content}
      onChange={(event) => setEditMessage({ _id: id, content: event.target.value })}
      className="!bg-background/80 min-h-11 w-full rounded-md border p-2 font-sans backdrop-blur-md backdrop-saturate-150 outline-none md:p-4"
      onKeyDown={async (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();

          setEditMessage(null);
          if (editedUserMessage?.content && editedUserMessage.content !== content) {
            await retryMessage(index, {
              editedUserMessage: { _id: id, content: editedUserMessage.content },
            });
          }
        }
      }}
    />
  );
}
