import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { Button } from "./ui/button";

import { cn } from "@/lib/utils";

export function ScrollButton() {
  function handleScroll(position: "top" | "bottom") {
    const element = document.querySelector("#messages-scrollarea");
    element?.scrollTo({
      top: position === "top" ? 0 : element.scrollHeight,
      behavior: "smooth",
    });
  }

  return (
    <div className="pointer-events-none w-full" data-slot="scroll-button">
      <div className="pointer-events-none flex w-full items-center justify-center">
        <div
          className={cn(
            "bg-muted/40 pointer-events-auto flex rounded-md border",
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
