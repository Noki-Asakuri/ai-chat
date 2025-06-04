import { BrainIcon, ChevronDownIcon, EyeIcon, RssIcon } from "lucide-react";
import type React from "react";

import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";

import { AllModelIds, getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";
import { modelImages } from "./svg/model-svg";

export function ModelPicker() {
  const { model } = useChatStore((state) => state.chatConfig);
  const data = getModelData(model);
  const Icon = data.provider === "unknown" ? null : modelImages[data.provider];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="hover:!bg-foreground/10 h-max cursor-pointer justify-between px-2 py-1.5 text-xs"
        >
          <div className="flex items-center justify-center gap-2">
            {Icon && <Icon className="size-4" />}
            <span className="w-max">{data.displayName}</span>
          </div>

          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[370px] min-w-max p-2">
        <ScrollArea className="h-[600px] max-w-full">
          <div className="grid grid-cols-1 gap-2 pr-4">
            {AllModelIds.sort().map((modelId) => (
              <ModelItem key={modelId} modelId={modelId} currentModel={model} />
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function ModelItem({ modelId, currentModel }: { modelId: AllModelIds; currentModel: string }) {
  const data = getModelData(modelId);
  const setActiveModel = useChatStore((state) => state.setChatConfig);

  const Icon = data.provider === "unknown" ? null : modelImages[data.provider];

  return (
    <button
      data-model={modelId}
      data-active={modelId === currentModel}
      className="hover:bg-input data-[active=true]:bg-input flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2"
      onMouseDown={() => setActiveModel({ model: modelId })}
    >
      <div className="flex items-center justify-center gap-2">
        {Icon && <Icon className="size-4" />}
        <span className="w-max">{data.displayName}</span>
      </div>

      <div className="flex items-center gap-2">
        <CapabilityIcon variant="webSearch" disable={data.capabilities.webSearch}>
          <RssIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon variant="reasoning" disable={data.capabilities.reasoning}>
          <BrainIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon variant="vision" disable={data.capabilities.vision}>
          <EyeIcon size={16} />
        </CapabilityIcon>
      </div>
    </button>
  );
}

function CapabilityIcon({
  children,
  variant,
  disable,
}: {
  children: React.ReactNode;
  variant: "reasoning" | "webSearch" | "vision";
  disable: boolean;
}) {
  return (
    <div
      className={cn("flex size-7 items-center justify-center rounded-md border", {
        "bg-[#25252e] *:stroke-[#94b8dc] hover:bg-[#25252e]": variant === "webSearch",
        "bg-[#252030] *:stroke-[#6a6aa2] hover:bg-[#252030]": variant === "reasoning",
        "bg-[#252b2b] *:stroke-[#79afa3] hover:bg-[#252b2b]": variant === "vision",
        hidden: !disable,
      })}
    >
      {children}
    </div>
  );
}
