import { BrainIcon, FileTextIcon, ImageIcon, ImagePlusIcon, WrenchIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import type { ModelData } from "@/lib/chat/models";
import { cn } from "@/lib/utils";

export function ModelCapability({ model, tooltip = true }: { model: ModelData; tooltip?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <CapabilityIcon
        variant="reasoning"
        enabled={model.capabilities.reasoning !== undefined}
        title="This model supports reasoning."
        tooltip={tooltip}
      >
        <BrainIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="imageInput"
        enabled={model.modalities.input.includes("image")}
        title="This model accepts image input."
        tooltip={tooltip}
      >
        <ImageIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="toolCalling"
        enabled={model.capabilities.toolCalling}
        title="This model supports tools."
        tooltip={tooltip}
      >
        <WrenchIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="pdfInput"
        enabled={model.modalities.input.includes("pdf")}
        title="This model accepts PDF input."
        tooltip={tooltip}
      >
        <FileTextIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="imageOutput"
        enabled={model.modalities.output.includes("image")}
        title="This model can produce native image output."
        tooltip={tooltip}
      >
        <ImagePlusIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="imageGeneration"
        enabled={model.capabilities.imageGeneration}
        title="This model can use the image generation tool."
        tooltip={tooltip}
      >
        <ImagePlusIcon size={16} />
      </CapabilityIcon>
    </div>
  );
}

type CapabilityIconProps = {
  children: React.ReactNode;
  variant: "toolCalling" | "reasoning" | "imageInput" | "pdfInput" | "imageOutput" | "imageGeneration";
  enabled?: boolean;
  title: string;
  tooltip?: boolean;
};

export function CapabilityIcon({ children, variant, enabled, title, tooltip = true }: CapabilityIconProps) {
  if (!enabled) return null;

  const icon = (
    <div
      title={tooltip ? undefined : title}
      className={cn("flex size-6.5 items-center justify-center rounded-md border", {
        "bg-[#25252e] *:stroke-[#94b8dc]": variant === "toolCalling",
        "bg-[#252030] *:stroke-[#6a6aa2]": variant === "reasoning",
        "bg-[#252b2b] *:stroke-[#79afa3]": variant === "imageInput" || variant === "pdfInput",
        "bg-[#252b2b] *:stroke-[#bb6616]": variant === "imageOutput" || variant === "imageGeneration",
      })}
    >
      {children}
      <span className="sr-only">{title}</span>
    </div>
  );

  if (!tooltip) return icon;

  return (
    <Tooltip>
      <TooltipTrigger delay={150} render={() => icon} />

      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}
