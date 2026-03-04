import { ChevronDownIcon } from "lucide-react";

import { ButtonWithTip } from "../ui/button";

import { setStickyToBottom } from "@/lib/chat/scroll-stickiness";

export function ScrollButton() {
  function handleScrollBottom(): void {
    setStickyToBottom(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("chat:force-scroll-bottom"));
    }
  }

  return (
    <div
      className="pointer-events-none mx-auto mb-2 flex w-full max-w-4xl justify-center"
      data-slot="scroll-button"
    >
      <ButtonWithTip
        type="button"
        title="Scroll to Bottom"
        size="icon-sm"
        onMouseDown={(event) => {
          event.preventDefault();
          handleScrollBottom();
        }}
        className="pointer-events-auto border-border bg-background/80 text-muted-foreground backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-card hover:bg-muted hover:text-foreground"
      >
        <ChevronDownIcon className="size-4" />
        <span className="sr-only">Scroll to Bottom</span>
      </ButtonWithTip>
    </div>
  );
}
