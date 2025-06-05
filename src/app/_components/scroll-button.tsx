import { useChatStore } from "@/lib/chat/store";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

export function ScrollButton() {
  const scrollPosition = useChatStore((state) => state.scrollPosition);

  function handleScrollBottom() {
    const element = document.querySelector("#messages-scrollarea") as HTMLDivElement | undefined;
    element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }

  function handleScrollTop() {
    const element = document.querySelector("#messages-scrollarea") as HTMLDivElement | undefined;
    element?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="pointer-events-none absolute -top-10 flex w-full items-center justify-center">
      <Button
        className={cn(
          "absolute -top-[80vh] w-38",
          "bg-muted/70 text-muted-foreground hover:bg-muted/90 border-border pointer-events-auto h-max cursor-pointer rounded-full border px-1.5 py-1 text-xs backdrop-blur-md transition-opacity",
          { "pointer-events-none opacity-0": scrollPosition === "top" },
        )}
        type="button"
        onMouseDown={handleScrollTop}
      >
        Scroll to Top
        <ChevronUpIcon />
      </Button>

      <Button
        className={cn(
          "bg-muted/70 text-muted-foreground hover:bg-muted/90 border-border pointer-events-auto h-max w-38 cursor-pointer rounded-full border px-1.5 py-1 text-xs backdrop-blur-md transition-opacity",
          { "pointer-events-none opacity-0": scrollPosition === "bottom" },
        )}
        type="button"
        onMouseDown={handleScrollBottom}
      >
        Scroll to Bottom
        <ChevronDownIcon />
      </Button>
    </div>
  );
}
