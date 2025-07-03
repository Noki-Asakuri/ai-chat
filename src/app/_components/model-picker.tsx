import { BrainIcon, ChevronDownIcon, EyeIcon, RssIcon } from "lucide-react";

import { CapabilityIcon } from "./capability-icon";
import { buttonVariants } from "./ui/button";
import { Icons } from "./ui/icons";
import { MenuArrow, Menu } from "./ui/menu";

import { AllModelIds, getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

export function ModelPicker() {
  const { model } = useChatStore((state) => state.chatConfig);
  const data = getModelData(model);

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "hover:!bg-primary/15 flex h-9 cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-xs",
          buttonVariants({ variant: "ghost" }),
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <Icons.provider provider={data?.provider} className="size-4" />
          <span className="w-max">{data?.display.unique ?? data?.display.name}</span>
        </div>

        <ChevronDownIcon />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={8} align="start">
          <Menu.Popup className="bg-popover/70 text-popover-foreground origin-[var(--transform-origin)] rounded-md border backdrop-blur-md backdrop-saturate-150 transition-[transform,scale,opacity] outline-none data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
            <MenuArrow className="fill-popover" />

            <div
              className="custom-scroll h-[600px] w-96 max-w-[calc(100vw-8rem)] overflow-y-auto px-2 py-4 outline-none"
              style={{ scrollbarGutter: "stable both-edges" }}
            >
              <div className="flex flex-col gap-2">
                {AllModelIds.sort().map((modelId) => (
                  <ModelItem key={modelId} modelId={modelId} currentModel={model} />
                ))}
              </div>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ModelItem({ modelId, currentModel }: { modelId: AllModelIds; currentModel: string }) {
  const data = getModelData(modelId);
  const setActiveModel = useChatStore((state) => state.setChatConfig);

  return (
    <Menu.Item
      data-model={modelId}
      data-active={modelId === currentModel}
      onClick={() => setActiveModel({ model: modelId })}
      closeOnClick={false}
      className="data-[highlighted]:border-primary/70 data-[highlighted]:bg-primary/20 data-[active=true]:border-primary/70 data-[active=true]:bg-primary/20 text-foreground flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm leading-4 outline-none select-none"
    >
      <div className="flex items-center justify-center gap-2">
        <Icons.provider provider={data.provider} className="size-4" />
        <span className="w-max text-sm">{data.display.unique ?? data.display.name}</span>
      </div>

      <div className="flex items-center gap-1">
        <CapabilityIcon
          variant="webSearch"
          enabled={data.capabilities.webSearch}
          title="This model supports web search."
        >
          <RssIcon size={14} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="reasoning"
          enabled={data.capabilities.reasoning !== false}
          title="This model supports reasoning."
        >
          <BrainIcon size={14} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="vision"
          enabled={data.capabilities.vision}
          title="This model supports vision."
        >
          <EyeIcon size={14} />
        </CapabilityIcon>
      </div>
    </Menu.Item>
  );
}
