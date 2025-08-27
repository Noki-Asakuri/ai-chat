import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { BrainIcon, ChevronDownIcon, EyeIcon, RssIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Select } from "@base-ui-components/react/select";

import { buttonVariants } from "../ui/button";
import { Icons } from "../ui/icons";
import { Input } from "../ui/input";

import { CapabilityIcon } from "../capability-icon";

import { AllModelIds, getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

type ModelSelectorProps = {
  value: string;
  onChange?: (id: string) => void;
};

function ModelSelectorBase({ value, onChange }: ModelSelectorProps) {
  const storeModel = useChatStore.getState().chatConfig.model;

  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const setChatConfig = useChatStore((s) => s.setChatConfig);

  const { data } = useQuery(convexQuery(api.functions.users.currentUser, {}));
  const hidden = useMemo(
    () => data?.customization?.hiddenModels ?? [],
    [data?.customization?.hiddenModels],
  );

  const visibleModels = useMemo(() => {
    return AllModelIds.slice()
      .sort()
      .filter((id) => !hidden.includes(id))
      .filter((modelId) => {
        const d = getModelData(modelId);
        const text =
          `${d?.display?.unique ?? d?.display?.name ?? ""} ${d?.provider ?? ""}`.toLowerCase();
        return text.includes(modelSearchQuery.trim().toLowerCase());
      });
  }, [hidden, modelSearchQuery]);

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
    <Select.Root value={value ?? storeModel} onValueChange={handleChange}>
      <Select.Trigger
        className={cn(
          "hover:!bg-primary/15 flex h-9 cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-xs",
          buttonVariants({ variant: "ghost" }),
        )}
      >
        <Select.Value>{renderTriggerValue}</Select.Value>
        <Select.Icon>
          <ChevronDownIcon />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner className="z-50 outline-none" sideOffset={8} align="start">
          <Select.Popup className="bg-popover/70 text-popover-foreground origin-[var(--transform-origin)] rounded-md border backdrop-blur-md backdrop-saturate-150 transition-[transform,scale,opacity] outline-none data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
            <div className="w-96 max-w-[calc(100vw-8rem)] outline-none">
              <div className="bg-popover/70 sticky top-0 z-10 p-2 backdrop-blur-md backdrop-saturate-150">
                <Input
                  value={modelSearchQuery}
                  placeholder="Search models…"
                  aria-label="Search models"
                  className="h-8 text-xs ring-0"
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                />
              </div>

              <div
                className="custom-scroll h-[400px] overflow-y-auto px-2 py-2"
                style={{ scrollbarGutter: "stable both-edges" }}
              >
                <div className="flex flex-col gap-2">
                  {visibleModels.map((modelId) => (
                    <ModelItem key={modelId} modelId={modelId} />
                  ))}

                  {visibleModels.length === 0 && (
                    <div className="text-muted-foreground px-2 py-1.5 text-center text-xs">
                      No models available. Enable models in Settings → Models.
                      <br />
                      Or change your search query.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function ChatModelSelector() {
  const { model: storeModel } = useChatStore((state) => state.chatConfig);
  return <ModelSelectorBase value={storeModel} />;
}

export function ModelSelector(props: ModelSelectorProps) {
  return <ModelSelectorBase {...props} />;
}

function ModelItem({ modelId }: { modelId: AllModelIds }) {
  const data = getModelData(modelId);

  return (
    <Select.Item
      value={modelId}
      label={data.display.unique ?? data.display.name}
      className="data-[highlighted]:border-primary/70 data-[highlighted]:bg-primary/20 data-[selected]:border-primary/70 data-[selected]:bg-primary/20 text-foreground flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm leading-4 outline-none select-none"
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
    </Select.Item>
  );
}
