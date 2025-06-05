import { useChatStore } from "@/lib/chat/store";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

export function ScrollButton() {
  const scrollPosition = useChatStore((state) => state.scrollPosition);
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  function handleScroll(position: "top" | "bottom") {
    const element = document.querySelector("#messages-scrollarea") as HTMLDivElement | undefined;
    element?.scrollTo({ top: position === "top" ? 0 : element.scrollHeight, behavior: "smooth" });
  }

  return (
    <div
      className="pointer-events-none fixed top-6 right-0 z-50 flex w-full flex-col items-center justify-between lg:w-[calc(100vw-280px)]"
      style={{ height: `calc(100% - ${textareaHeight === 140 ? 140 : textareaHeight + 10}px - 24px)` }}
    >
      <Button
        type="button"
        onMouseDown={() => handleScroll("top")}
        className={cn(
          "bg-muted/70 text-muted-foreground hover:bg-muted/90 h-max w-38 cursor-pointer border px-1.5 py-1 text-xs opacity-0 backdrop-blur-md transition-opacity",
          { "pointer-events-auto opacity-100": scrollPosition === "bottom" || scrollPosition === "middle" },
        )}
      >
        Scroll to Top
        <ChevronUpIcon />
      </Button>

      <Button
        type="button"
        onMouseDown={() => handleScroll("bottom")}
        className={cn(
          "bg-muted/70 text-muted-foreground hover:bg-muted/90 h-max w-38 cursor-pointer border px-1.5 py-1 text-xs opacity-0 backdrop-blur-md transition-opacity",
          { "pointer-events-auto opacity-100": scrollPosition === "top" || scrollPosition === "middle" },
        )}
      >
        Scroll to Bottom
        <ChevronDownIcon />
      </Button>
    </div>
  );
}
