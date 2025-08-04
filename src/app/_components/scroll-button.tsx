import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Button } from "./ui/button";
import { useSidebar } from "./ui/sidebar";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ScrollButton() {
  const textareaHeight = useChatStore((state) => state.textareaHeight);
  const { state, isMobile } = useSidebar();

  function handleScroll(position: "top" | "bottom") {
    const element = document.querySelector("#messages-scrollarea") as HTMLDivElement | undefined;
    element?.scrollTo({
      top: position === "top" ? 0 : element.scrollHeight,
      behavior: "smooth",
    });
  }

  const containerWidth =
    state === "collapsed" || isMobile ? "100vw" : "calc(100vw - var(--sidebar-width))";

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 w-full transition-[width]"
      style={{
        height: `calc(100% - ${Math.max(textareaHeight, 140)}px)`,
        width: containerWidth,
      }}
    >
      <div
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 flex w-full items-center justify-center",
        )}
      >
        <div
          className={cn(
            "bg-muted/40 pointer-events-auto flex rounded-t-[calc(var(--spacing)*2+calc(var(--radius)-2px))] border-x border-t",
            "group-data-[disable-blur=true]/sidebar-provider:bg-muted",
            "w-full max-w-4xl backdrop-blur-md backdrop-saturate-150",
          )}
        >
          <Button
            type="button"
            onMouseDown={() => handleScroll("top")}
            variant="ghost"
            className={cn(
              "h-7 justify-center rounded-none px-3 sm:px-4",
              "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              "flex grow gap-2",
            )}
          >
            <ChevronUpIcon className="h-4 w-4 shrink-0" />
            <span className="hidden text-xs md:inline">Scroll to Top</span>
          </Button>

          <div className="bg-border w-px grow-0" />

          <Button
            type="button"
            onMouseDown={() => handleScroll("bottom")}
            variant="ghost"
            className={cn(
              "h-7 justify-center rounded-none px-3 sm:px-4",
              "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              "flex grow gap-2",
            )}
          >
            <ChevronDownIcon className="h-4 w-4 shrink-0" />
            <span className="hidden text-xs md:inline">Scroll to Bottom</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
