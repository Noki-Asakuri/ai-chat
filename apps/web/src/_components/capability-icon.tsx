import { BrainIcon, FileTextIcon, ImageIcon, ImagePlusIcon, WrenchIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import type { ModelData } from "@/lib/chat/models";
import { cn } from "@/lib/utils";

export function ModelCapability({ model }: { model: ModelData }) {
  return (
    <div className="flex items-center gap-1">
      <CapabilityIcon
        variant="reasoning"
        enabled={model.capabilities.reasoning !== undefined}
        title="This model supports reasoning."
      >
        <BrainIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="imageInput"
        enabled={model.modalities.input.includes("image")}
        title="This model accepts image input."
      >
        <ImageIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="toolCalling"
        enabled={model.capabilities.toolCalling}
        title="This model supports tools."
      >
        <WrenchIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="pdfInput"
        enabled={model.modalities.input.includes("pdf")}
        title="This model accepts PDF input."
      >
        <FileTextIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="imageOutput"
        enabled={model.modalities.output.includes("image")}
        title="This model can produce native image output."
      >
        <ImagePlusIcon size={16} />
      </CapabilityIcon>

      <CapabilityIcon
        variant="imageGeneration"
        enabled={model.capabilities.imageGeneration}
        title="This model can use the image generation tool."
      >
        <ImagePlusIcon size={16} />
      </CapabilityIcon>
    </div>
  );
}

type CapabilityIconProps = {
  children: React.ReactNode;
  variant:
    | "toolCalling"
    | "reasoning"
    | "imageInput"
    | "pdfInput"
    | "imageOutput"
    | "imageGeneration";
  enabled?: boolean;
  title: string;
};

export function CapabilityIcon({ children, variant, enabled, title }: CapabilityIconProps) {
  if (!enabled) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        delay={150}
        render={() => (
          <div
            className={cn("flex size-6.5 items-center justify-center rounded-md border", {
              "bg-[#25252e] *:stroke-[#94b8dc]": variant === "toolCalling",
              "bg-[#252030] *:stroke-[#6a6aa2]": variant === "reasoning",
              "bg-[#252b2b] *:stroke-[#79afa3]":
                variant === "imageInput" || variant === "pdfInput",
              "bg-[#252b2b] *:stroke-[#bb6616]":
                variant === "imageOutput" || variant === "imageGeneration",
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
