import * as React from "react";
import { NumberField } from "@base-ui/react/number-field";
import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function NumberInput({ className, ...props }: React.ComponentProps<typeof NumberField.Root>) {
  return (
    <NumberField.Root className={cn("flex flex-col items-start gap-1", className)} {...props}>
      <NumberField.ScrubArea className="cursor-ew-resize">
        <NumberField.ScrubAreaCursor className="drop-shadow-[0_1px_1px_#0008] filter">
          <CursorGrowIcon />
        </NumberField.ScrubAreaCursor>
      </NumberField.ScrubArea>

      <NumberField.Group className="flex">
        <NumberField.Decrement className="flex size-7 items-center justify-center rounded-tl rounded-bl border bg-popover bg-clip-padding text-foreground select-none">
          <MinusIcon />
        </NumberField.Decrement>

        <NumberField.Input className="h-7 w-18 border-t border-b text-center text-sm text-foreground tabular-nums outline-none focus:z-1" />

        <NumberField.Increment className="flex size-7 items-center justify-center rounded-tr rounded-br border bg-popover bg-clip-padding text-foreground select-none">
          <PlusIcon />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}

NumberInput.displayName = "NumberInput";

function CursorGrowIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      width="26"
      height="14"
      viewBox="0 0 24 14"
      fill="black"
      stroke="white"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
    </svg>
  );
}

export { NumberInput };
