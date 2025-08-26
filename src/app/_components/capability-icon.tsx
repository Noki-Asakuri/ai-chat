import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import { cn } from "@/lib/utils";

type CapabilityIconProps = {
  children: React.ReactNode;
  variant: "webSearch" | "reasoning" | "vision";
  enabled?: boolean;
  title: string;
};

export function CapabilityIcon({ children, variant, enabled, title }: CapabilityIconProps) {
  return (
    <Tooltip delay={150}>
      <TooltipTrigger
        render={() => (
          <div
            className={cn("flex size-6.5 items-center justify-center rounded-md border", {
              "bg-[#25252e] *:stroke-[#94b8dc]": variant === "webSearch",
              "bg-[#252030] *:stroke-[#6a6aa2]": variant === "reasoning",
              "bg-[#252b2b] *:stroke-[#79afa3]": variant === "vision",
              hidden: !enabled,
            })}
          >
            {children}
          </div>
        )}
      />

      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}
