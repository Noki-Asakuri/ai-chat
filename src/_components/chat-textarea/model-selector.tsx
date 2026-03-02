import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronDownIcon } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { ModelCapability } from "../capability-icon";

import { AllModelIds, tryGetModelData } from "@/lib/chat/models";
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
    const modelData = tryGetModelData(value);

    if (!modelData) {
      return (
        <div className="flex min-w-0 items-center gap-2">
          <Icons.unknown className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Unknown model</span>
        </div>
      );
    }

    return (
      <div className="flex min-w-0 items-center gap-2">
        <Icons.provider provider={modelData?.provider} className="size-4 shrink-0" />
        <span className="min-w-0 truncate">
          {modelData?.display?.unique ?? modelData?.display?.name}
        </span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        id={triggerId}
        aria-label="Select model"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 min-w-0 cursor-pointer gap-2 border border-border bg-background/40 px-2.5 py-1.5 shadow-xs hover:bg-primary/12! focus-visible:ring-2 focus-visible:ring-ring/30",
          "flex items-center justify-between rounded-md",
          className,
        )}
      >
        {renderTriggerValue(selectedModel)}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent
        sideOffset={8}
        includeArrow={false}
        className={cn(
          "w-[min(22rem,calc(100vw-1.5rem))] p-0",
          "rounded-md border border-border bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10",
        )}
      >
        <Command
          loop
          value={selectedModel}
          className="rounded-md bg-transparent text-popover-foreground"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 pt-2 pb-1.5">
            <div className="min-w-0 text-xs font-medium text-foreground">Models</div>
            <div className="shrink-0 text-[11px] text-muted-foreground">Type to search</div>
          </div>

          <CommandInput placeholder="Search models..." className="h-9" />

          <CommandList
            className="custom-scroll max-h-[min(22rem,calc(100vh-12rem))] px-1.5 py-2"
            style={{ scrollbarGutter: "stable both-edges" }}
          >
            <CommandEmpty className="px-2 py-6 text-center text-xs text-muted-foreground">
              No models available. Enable models in Settings → Models.
            </CommandEmpty>

            <CommandGroup className="[&_[cmdk-group-heading]]:hidden">
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
      </PopoverContent>
    </Popover>
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
  const data = tryGetModelData(value);
  if (!data) return null;

  return (
    <CommandItem
      value={value}
      onSelect={onChange}
      data-model-selected={selected}
      title={data.display.unique ?? data.display.name}
      className={cn(
        "mt-1 w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2 outline-none select-none first:mt-0",
        "rounded-md border border-transparent",
        "data-selected:bg-muted/70 data-selected:text-foreground",
        "data-[model-selected=true]:bg-primary/10 data-[model-selected=true]:text-foreground data-[model-selected=true]:ring-1 data-[model-selected=true]:ring-primary/20",
        "[&>svg:last-child]:hidden",
        "data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icons.provider provider={data.provider} className="size-4 shrink-0" />
        <span className="min-w-0 truncate text-xs">{data.display.unique ?? data.display.name}</span>
      </div>

      <div className="shrink-0">
        <ModelCapability model={data} />
      </div>
    </CommandItem>
  );
}
