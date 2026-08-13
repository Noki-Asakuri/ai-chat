import { MessageContent as MessageBubble } from "../ui/ai-elements/message";
import { Icons } from "../ui/icons";

export function MessagePending() {
  return (
    <MessageBubble
      data-slot="message-pending"
      className="surface-edge flex w-full items-center gap-2 bg-background/75 text-foreground/80 backdrop-blur-md backdrop-saturate-150 md:p-4"
    >
      <Icons.loading className="size-5 fill-primary stroke-primary text-primary" />
      <span className="shimmer font-medium shimmer-duration-1200">Thinking…</span>
    </MessageBubble>
  );
}
