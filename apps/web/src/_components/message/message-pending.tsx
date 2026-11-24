import { LoaderCircleIcon } from "lucide-react";

type MessagePendingProps = {
  isReasoning: boolean;
};

export function MessagePending({ isReasoning }: MessagePendingProps) {
  const label = isReasoning ? "Thinking…" : "Generating response…";

  return (
    <output
      data-slot="message-pending"
      className="inline-flex h-7 items-center gap-2 text-sm text-muted-foreground"
    >
      <LoaderCircleIcon
        aria-hidden="true"
        className="size-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
      />
      <span className="shimmer shimmer-duration-1200">{label}</span>
    </output>
  );
}
