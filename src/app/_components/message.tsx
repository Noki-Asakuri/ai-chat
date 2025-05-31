import { MemoizedMarkdown } from "./markdown";

import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

export function Message({ message }: { message: Message }) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn("prose dark:prose-invert space-y-2", {
          "bg-muted ml-auto rounded-md px-4 py-2": message.role === "user",
        })}
      >
        <MemoizedMarkdown id={message.messageId} content={message.content} />
      </div>

      {message.role === "user" && (
        <div className="bg-muted flex size-11 items-center justify-center rounded-md">You</div>
      )}
    </div>
  );
}
