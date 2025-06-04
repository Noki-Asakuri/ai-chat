import { useChatStore } from "@/lib/chat/store";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";

export function ScrollDownButton() {
  const isAtBottom = useChatStore((state) => state.isAtBottom);

  function handleScrollDown() {
    const element = document.querySelector("#messages-scrollarea") as HTMLDivElement | undefined;
    element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }

  return (
    <div className="pointer-events-none absolute -top-10 flex w-full items-center justify-center">
      <Button
        className={cn(
          "bg-muted/70 text-muted-foreground hover:bg-muted/90 border-border pointer-events-auto h-max w-max cursor-pointer rounded-full border px-1.5 py-1 text-xs backdrop-blur-md transition-opacity",
          { "pointer-events-none opacity-0": isAtBottom },
        )}
        type="button"
        onMouseDown={handleScrollDown}
      >
        Scroll to Bottom
        <ChevronDownIcon />
      </Button>
    </div>
  );
}
