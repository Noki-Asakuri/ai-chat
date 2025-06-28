import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Button } from "./ui/button";
import { useSidebar } from "./ui/sidebar";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ScrollButton() {
  const scrollPosition = useChatStore((state) => state.scrollPosition);
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const { state, isMobile } = useSidebar();

  function handleScroll(position: "top" | "bottom") {
    const element = document.querySelector("#messages-scrollarea") as HTMLDivElement | undefined;
    element?.scrollTo({ top: position === "top" ? 0 : element.scrollHeight, behavior: "smooth" });
  }

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 w-full transition-[width,height]"
      style={{
        height: `calc(100% - ${textareaHeight === 140 ? 140 : textareaHeight + 10}px)`,
        width: `${state === "collapsed" || isMobile ? "100vw" : "calc(100vw - var(--sidebar-width))"}`,
      }}
    >
      <div className="pointer-events-none absolute top-4 left-0 flex w-full items-center justify-center">
        <Button
          type="button"
          onMouseDown={() => handleScroll("top")}
          className={cn(
            "bg-muted/70 text-muted-foreground hover:bg-muted/90 h-max w-38 cursor-pointer border px-1.5 py-1 text-xs opacity-0 backdrop-blur-md transition-opacity",
            {
              "pointer-events-auto opacity-100":
                scrollPosition === "bottom" || scrollPosition === "middle",
            },
          )}
        >
          Scroll to Top
          <ChevronUpIcon />
        </Button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-0 flex w-full items-center justify-center">
        <Button
          type="button"
          onMouseDown={() => handleScroll("bottom")}
          className={cn(
            "bg-muted/70 text-muted-foreground hover:bg-muted/90 h-max w-38 cursor-pointer border px-1.5 py-1 text-xs opacity-0 backdrop-blur-md transition-opacity",
            {
              "pointer-events-auto opacity-100":
                scrollPosition === "top" || scrollPosition === "middle",
            },
          )}
        >
          Scroll to Bottom
          <ChevronDownIcon />
        </Button>
      </div>
    </div>
  );
}
