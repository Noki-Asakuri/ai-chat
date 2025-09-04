import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { BrainIcon, ChevronDownIcon, EyeIcon, GlobeIcon } from "lucide-react";
import { useMemo } from "react";

import { Popover } from "@base-ui-components/react/popover";

import { buttonVariants } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Icons } from "../ui/icons";

import { CapabilityIcon } from "../capability-icon";

import { AllModelIds, getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

type ModelSelectorProps = {
  value: string;
  onChange?: (id: string) => void;
  triggerId?: string;
};

function ModelSelectorBase({ value, onChange, triggerId }: ModelSelectorProps) {
  const storeModel = useChatStore.getState().chatConfig.model;
  const setChatConfig = useChatStore((s) => s.setChatConfig);

  const selectedModel = value ?? storeModel;

  const { data } = useQuery(convexQuery(api.functions.users.currentUser, {}));
  const hidden = useMemo(
    () => data?.customization?.hiddenModels ?? [],
    [data?.customization?.hiddenModels],
  );

  const visibleModels = useMemo(() => {
    return AllModelIds.slice()
      .sort()
      .filter((id) => !hidden.includes(id));
  }, [hidden]);

  function handleChange(model: string) {
    if (onChange) onChange(model);
    else setChatConfig({ model });
  }

  function renderTriggerValue(value: string) {
    const modelData = getModelData(value);

    return (
      <div className="flex items-center justify-center gap-2">
        <Icons.provider provider={modelData?.provider} className="size-4" />
        <span className="w-max">{modelData?.display?.unique ?? modelData?.display?.name}</span>
      </div>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        id={triggerId}
        className={cn(
          "hover:!bg-primary/15 flex h-9 cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-xs",
          buttonVariants({ variant: "ghost" }),
        )}
      >
        {renderTriggerValue(value)}
        <ChevronDownIcon />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="origin-[var(--transform-origin)] rounded-md transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
            <Command
              loop
              value={selectedModel}
              className="bg-card text-card-foreground h-[400px] w-max min-w-100 border"
            >
              <CommandInput placeholder="Search models..." className="h-9" />
              <CommandList
                className="custom-scroll space-y-2 px-1 py-2"
                style={{ scrollbarGutter: "stable both-edges" }}
              >
                <CommandEmpty>
                  No models available. Enable models in Settings → Models.
                </CommandEmpty>

                <CommandGroup>
                  {visibleModels.map((modelId) => (
                    <ModelItem
                      selected={modelId === selectedModel}
                      key={modelId}
                      value={modelId}
                      onChange={handleChange}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function ChatModelSelector() {
  const { model: storeModel } = useChatStore((state) => state.chatConfig);
  return <ModelSelectorBase value={storeModel} triggerId="button-chat-model-selector-trigger" />;
}

export function ModelSelector(props: ModelSelectorProps) {
  return <ModelSelectorBase {...props} />;
}

function ModelItem({ selected, value, onChange }: ModelSelectorProps & { selected: boolean }) {
  const data = getModelData(value);

  return (
    <CommandItem
      value={value}
      onSelect={onChange}
      data-model-selected={selected}
      title={data.display.unique ?? data.display.name}
      className="data-[model-selected=true]:!bg-secondary data-[model-selected=true]:!text-secondary-foreground data-[selected=true]:bg-card data-[selected=true]:text-card-foreground data-[selected=true]:border-ring/60 mt-1 cursor-pointer justify-between gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm leading-4 transition-[border-color] outline-none select-none first:mt-0"
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
          <GlobeIcon size={14} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="reasoning"
          enabled={
            (typeof data.capabilities.reasoning === "boolean" &&
              data.capabilities.reasoning === true) ||
            data.capabilities.reasoning === "always"
          }
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
    </CommandItem>
  );
}
