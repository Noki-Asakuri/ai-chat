import { useParams } from "@tanstack/react-router";
import { Popover } from "@base-ui/react/popover";
import { useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";

import { buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Icons } from "@/components/ui/icons";

import { ModelCapability } from "../capability-icon";

import { AllModelIds, getModelData } from "@/lib/chat/models";
import { cn } from "@/lib/utils";

type ModelSelectorProps = {
  value: string;
  onChange?: (id: string) => void;
  triggerId?: string;
  className?: string;
};

function ModelSelectorBase({ value, onChange, triggerId, className }: ModelSelectorProps) {
  const configStore = useConfigStoreState();

  const storeModel = configStore.model;
  const storeDefaultModel = configStore.defaultModel;

  const selectedModel =
    (value && value.length > 0 ? value : null) ??
    (storeModel && storeModel.length > 0 ? storeModel : null) ??
    storeDefaultModel;

  const hiddenModel = useConfigStore(useShallow((state) => state.hiddenModels));

  const visibleModels = useMemo(() => {
    return AllModelIds.slice()
      .sort((a, b) => a.localeCompare(b))
      .filter((id) => !hiddenModel.includes(id));
  }, [hiddenModel]);

  function handleChange(model: string) {
    if (onChange) onChange(model);
    else configStore.setConfig({ model });
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
          buttonVariants({ variant: "ghost" }),
          "flex h-9 cursor-pointer items-center justify-between gap-2 border px-2 py-1.5 hover:bg-primary/15!",
          className,
        )}
      >
        {renderTriggerValue(selectedModel)}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="origin-(--transform-origin) rounded-md transition-[transform,scale,opacity] data-ending-style:scale-90 data-ending-style:opacity-0 data-starting-style:scale-90 data-starting-style:opacity-0">
            <Command
              loop
              value={selectedModel}
              className="h-100 w-max min-w-100 border bg-card text-card-foreground"
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
  const params = useParams({ from: "/_chat_layout/threads/$threadId", shouldThrow: false });
  const isWelcomeRoute = !params?.threadId;

  const storeModel = useConfigStore((state) => state.model);
  const setConfig = useConfigStore((state) => state.setConfig);

  function handleChange(model: string) {
    if (isWelcomeRoute) {
      setConfig({ model, defaultModel: model });
      return;
    }

    setConfig({ model });
  }

  return (
    <ModelSelectorBase
      value={storeModel}
      onChange={handleChange}
      triggerId="button-chat-model-selector-trigger"
    />
  );
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
      className="mt-1 cursor-pointer justify-between gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm leading-4 transition-[border-color] outline-none select-none first:mt-0 data-[model-selected=true]:bg-secondary! data-[model-selected=true]:text-secondary-foreground! data-[selected=true]:border-ring/60 data-[selected=true]:bg-card data-[selected=true]:text-card-foreground"
    >
      <div className="flex items-center justify-center gap-2">
        <Icons.provider provider={data.provider} className="size-4" />
        <span className="w-max text-sm">{data.display.unique ?? data.display.name}</span>
      </div>

      <ModelCapability model={data} />
    </CommandItem>
  );
}
