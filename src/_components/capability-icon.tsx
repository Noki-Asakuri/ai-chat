import { BrainIcon, EyeIcon, GlobeIcon, ImagePlusIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import type { ModelData } from "@/lib/chat/models";
import { cn } from "@/lib/utils";

export function ModelCapability({ model }: { model: ModelData }) {
  return (
    <div className="flex items-center gap-1">
      <CapabilityIcon
        variant="reasoning"
        enabled={model.capabilities.reasoning === true || model.capabilities.reasoning === "always"}
        title="This model supports reasoning."
      >
        <BrainIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="imageGeneration"
        enabled={model.capabilities.generateImage}
        title="This model supports image generation."
      >
        <ImagePlusIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="webSearch"
        enabled={model.capabilities.webSearch}
        title="This model supports web search."
      >
        <GlobeIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="vision"
        enabled={model.capabilities.vision}
        title="This model supports vision."
      >
        <EyeIcon size={16} />
      </CapabilityIcon>
    </div>
  );
}

type CapabilityIconProps = {
  children: React.ReactNode;
  variant: "webSearch" | "reasoning" | "vision" | "imageGeneration";
  enabled?: boolean;
  title: string;
};

export function CapabilityIcon({ children, variant, enabled, title }: CapabilityIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={150}
        render={() => (
          <div
            className={cn("flex size-6.5 items-center justify-center rounded-md border", {
              "bg-[#25252e] *:stroke-[#94b8dc]": variant === "webSearch",
              "bg-[#252030] *:stroke-[#6a6aa2]": variant === "reasoning",
              "bg-[#252b2b] *:stroke-[#79afa3]": variant === "vision",
              "bg-[#252b2b] *:stroke-[#bb6616]": variant === "imageGeneration",
              hidden: !enabled,
            })}
          >
            {children}
            <span className="sr-only">{title}</span>
          </div>
        )}
      />

      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}
