import { BrainIcon, ChevronDownIcon, EyeIcon, RssIcon } from "lucide-react";
import type React from "react";

import { Button } from "./ui/button";
import { Icons } from "./ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

import { AllModelIds, getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ModelPicker() {
  const { model } = useChatStore((state) => state.chatConfig);
  const data = getModelData(model);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="hover:!bg-primary/15 h-9 cursor-pointer justify-between px-2 py-1.5 text-xs"
        >
          <div className="flex items-center justify-center gap-2">
            <Icons.provider provider={data?.provider} className="size-4" />
            <span className="w-max">{data?.displayName}</span>
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

  return (
    <button
      data-model={modelId}
      data-active={modelId === currentModel}
      className="hover:bg-primary/10 data-[active=true]:border-primary/70 data-[active=true]:bg-primary/20 text-foreground flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2"
      onMouseDown={() => setActiveModel({ model: modelId })}
    >
      <div className="flex items-center justify-center gap-2">
        <Icons.provider provider={data.provider} className="size-4" />
        <span className="w-max">{data.displayName}</span>
      </div>

      <div className="flex items-center gap-2">
        <CapabilityIcon
          variant="webSearch"
          disable={data.capabilities.webSearch}
          title="This model supports web search."
        >
          <RssIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="reasoning"
          disable={data.capabilities.reasoning}
          title="This model supports reasoning."
        >
          <BrainIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="vision"
          disable={data.capabilities.vision}
          title="This model supports vision."
        >
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
  title,
}: {
  children: React.ReactNode;
  variant: "reasoning" | "webSearch" | "vision";
  disable: boolean;
  title: string;
}) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <div
          className={cn("flex size-7 items-center justify-center rounded-md border", {
            "bg-[#25252e] *:stroke-[#94b8dc]": variant === "webSearch",
            "bg-[#252030] *:stroke-[#6a6aa2]": variant === "reasoning",
            "bg-[#252b2b] *:stroke-[#79afa3]": variant === "vision",
            hidden: !disable,
          })}
        >
          {children}
        </div>
      </TooltipTrigger>

      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}
