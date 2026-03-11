import { useEffect, useState } from "react";

import { ChevronDownIcon } from "lucide-react";

import { ButtonWithTip } from "../ui/button";

import {
  computeIsAtBottom,
  getMessagesScrollAreaElement,
  setStickyToBottom,
} from "@/lib/chat/scroll-stickiness";

function getIsAtBottom(): boolean {
  const scrollElement = getMessagesScrollAreaElement();
  if (!scrollElement) return true;
  return computeIsAtBottom(scrollElement);
}

export function ScrollButton() {
  const [isAtBottom, setIsAtBottom] = useState(getIsAtBottom);

  useEffect(() => {
    function syncButtonVisibility(): void {
      setIsAtBottom(getIsAtBottom());
    }

    const scrollEventOptions: AddEventListenerOptions = { capture: true, passive: true };

    syncButtonVisibility();

    window.addEventListener("scroll", syncButtonVisibility, scrollEventOptions);
    window.addEventListener("resize", syncButtonVisibility);
    window.addEventListener("chat:scroll-if-sticky", syncButtonVisibility);
    window.addEventListener("chat:force-scroll-bottom", syncButtonVisibility);

    return () => {
      window.removeEventListener("scroll", syncButtonVisibility, scrollEventOptions);
      window.removeEventListener("resize", syncButtonVisibility);
      window.removeEventListener("chat:scroll-if-sticky", syncButtonVisibility);
      window.removeEventListener("chat:force-scroll-bottom", syncButtonVisibility);
    };
  }, []);

  if (isAtBottom) return null;

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
