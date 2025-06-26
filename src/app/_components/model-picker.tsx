import { BrainIcon, ChevronDownIcon, EyeIcon, RssIcon } from "lucide-react";

import { Button } from "./ui/button";
import { Icons } from "./ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";

import { CapabilityIcon } from "./capability-icon";

import { AllModelIds, getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";

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
          <div className="grid grid-cols-1 gap-2 pr-3">
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
      className="hover:bg-primary/10 data-[active=true]:border-primary/70 data-[active=true]:bg-primary/20 text-foreground flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-1.5"
      onMouseDown={() => setActiveModel({ model: modelId })}
    >
      <div className="flex items-center justify-center gap-2">
        <Icons.provider provider={data.provider} className="size-4" />
        <span className="w-max text-sm">{data.displayName}</span>
      </div>

      <div className="flex items-center gap-1">
        <CapabilityIcon
          variant="webSearch"
          disable={data.capabilities.webSearch}
          title="This model supports web search."
        >
          <RssIcon size={14} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="reasoning"
          disable={data.capabilities.reasoning !== false}
          title="This model supports reasoning."
        >
          <BrainIcon size={14} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="vision"
          disable={data.capabilities.vision}
          title="This model supports vision."
        >
          <EyeIcon size={14} />
        </CapabilityIcon>
      </div>
    </button>
  );
}
