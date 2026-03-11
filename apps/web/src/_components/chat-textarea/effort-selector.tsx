import { BrainIcon, SignalHighIcon, SignalLowIcon, SignalMediumIcon } from "lucide-react";
import { useEffect, useEffectEvent } from "react";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "../provider/config-provider";
import { Button, buttonVariants } from "../ui/button";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "../ui/popover";

import { tryGetModelData } from "@/lib/chat/models";
import { useSyncThreadModelConfig } from "@/lib/chat/server-function/sync-thread-model-config";
import type { ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

type EffortSelectorProps = {
  value: ReasoningEffort;
  model: string;
  onChange?: (effort: ReasoningEffort) => void;
  className?: string;
};

export function ChatEffortSelector() {
  const config = useConfigStore(
    useShallow((state) => ({ effort: state.effort, model: state.model })),
  );
  return <EffortSelectorBase value={config.effort} model={config.model} />;
}

export function EffortSelector(props: EffortSelectorProps) {
  return <EffortSelectorBase {...props} />;
}

export const EFFORT_OPTIONS: Record<
  ReasoningEffort,
  { label: string; icon: typeof SignalLowIcon }
> = {
  none: { label: "None", icon: SignalLowIcon },
  minimal: { label: "Minimal", icon: SignalLowIcon },
  low: { label: "Low", icon: SignalLowIcon },
  medium: { label: "Medium", icon: SignalMediumIcon },
  high: { label: "High", icon: SignalHighIcon },
  xhigh: { label: "XHigh", icon: SignalHighIcon },
};

type EffortSelectorBaseInnerProps = EffortSelectorProps & {
  modelData: NonNullable<ReturnType<typeof tryGetModelData>>;
};

export function EffortSelectorBase(props: EffortSelectorProps) {
  const modelData = tryGetModelData(props.model);
  if (!modelData) return null;

  return <EffortSelectorBaseInner {...props} modelData={modelData} />;
}

function EffortSelectorBaseInner({ modelData, ...props }: EffortSelectorBaseInnerProps) {
  const configStore = useConfigStoreState();
  const { syncThreadModelConfig } = useSyncThreadModelConfig();

  const shouldHideSelector =
    typeof modelData.capabilities.reasoning === "undefined" ||
    modelData.capabilities.reasoning === "always" ||
    modelData.capabilities.reasoning === false;

  const handleChange = useEffectEvent((effort: ReasoningEffort) => {
    if (props.onChange) {
      props.onChange(effort);
      return;
    }

    configStore.setConfig({ effort });
    void syncThreadModelConfig({
      model: props.model,
      modelParams: { effort },
    });
  });

  // If they don't have customReasoningLevel, we fallback to the only 3 levels.
  const validOptions = Object.entries(EFFORT_OPTIONS).filter(([key]) =>
    modelData.capabilities.customReasoningLevel
      ? modelData.capabilities.customReasoningLevel?.includes(key as ReasoningEffort)
      : ["high", "medium", "low"].includes(key),
  );

  useEffect(() => {
    const validKeys = validOptions.map(([key]) => key);

    if (!validKeys.includes(props.value)) {
      handleChange(validKeys[0] as ReasoningEffort);
    }
  }, [props.value, validOptions]);

  if (shouldHideSelector) return null;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "flex h-9 cursor-pointer items-center justify-between gap-2 border border-border px-2 py-1.5 capitalize hover:bg-primary/15!",
          props.className,
        )}
      >
        <BrainIcon className="size-4" />
        {props.value}
      </PopoverTrigger>

      <PopoverContent
        className="w-max rounded-md bg-card p-1 text-card-foreground"
        includeArrow={false}
        sideOffset={8}
      >
        <PopoverArrow className="fill-card" />

        <div className="flex flex-col gap-1">
          {validOptions.map(([key, { label, icon: Icon }]) => (
            <Button
              key={`effort-selector-${key}`}
              variant="ghost"
              size="default"
              className="w-full cursor-pointer justify-start"
              onClick={() => handleChange(key as ReasoningEffort)}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
