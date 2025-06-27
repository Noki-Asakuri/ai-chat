"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui-components/react/scroll-area";

import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewport?: {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
  };
};

function ScrollArea({ className, viewport, children, onScroll, ...props }: Props) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        id={viewport?.id}
        onScroll={onScroll}
        style={viewport?.style}
        className={cn(
          "focus-visible:ring-ring/50 size-full h-full overscroll-contain rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
          viewport?.className,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  fade = true,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar> & { fade?: boolean }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "bg-muted/20 m-2 flex w-1 justify-center rounded",
        {
          "opacity-0 transition-opacity delay-300 data-[hovering]:opacity-100 data-[hovering]:delay-0 data-[hovering]:duration-75 data-[scrolling]:opacity-100 data-[scrolling]:delay-0 data-[scrolling]:duration-75":
            fade,
        },
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="bg-muted w-full rounded"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar, ScrollAreaPrimitive };
