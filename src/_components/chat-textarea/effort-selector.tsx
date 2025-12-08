import { BrainIcon, SignalHighIcon, SignalLowIcon, SignalMediumIcon } from "lucide-react";
import { useEffect } from "react";
import { useShallow } from "zustand/shallow";

import { Button, buttonVariants } from "../ui/button";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "../ui/popover";

import { getModelData } from "@/lib/chat/models";
import { configStore, useConfigStore } from "@/lib/store/config-store";
import type { ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

type EffortSelectorProps = {
  value: string;
  modelId: string;
  onChange?: (effort: ReasoningEffort) => void;
  className?: string;
};

export function ChatEffortSelector() {
  const config = useConfigStore(
    useShallow((state) => ({ effort: state.effort, model: state.model })),
  );
  return <EffortSelectorBase value={config.effort} modelId={config.model} />;
}

export function EffortSelector(props: EffortSelectorProps) {
  return <EffortSelectorBase {...props} />;
}

const EFFORT_OPTIONS: Record<ReasoningEffort, { label: string; icon: typeof SignalLowIcon }> = {
  none: { label: "None", icon: SignalLowIcon },
  minimal: { label: "Minimal", icon: SignalLowIcon },
  low: { label: "Low", icon: SignalLowIcon },
  medium: { label: "Medium", icon: SignalMediumIcon },
  high: { label: "High", icon: SignalHighIcon },
};

export function EffortSelectorBase(props: EffortSelectorProps) {
  const modelData = getModelData(props.modelId);

  const shouldHideSelector =
    typeof modelData.capabilities.reasoning === "undefined" ||
    modelData.capabilities.reasoning === "always" ||
    modelData.capabilities.reasoning === false;

  function handleChange(effort: ReasoningEffort) {
    if (props.onChange) props.onChange(effort);
    else configStore.setConfig({ effort });
  }

  if (shouldHideSelector) return null;

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
  }, [modelData]);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "flex h-9 cursor-pointer items-center justify-between gap-2 border px-2 py-1.5 capitalize hover:bg-primary/15!",
          props.className,
        )}
      >
        <BrainIcon className="size-4" />
        {props.value}
      </PopoverTrigger>

      <PopoverContent className="w-max bg-card p-1 text-card-foreground" includeArrow={false}>
        <PopoverArrow className="fill-card" />

        <div className="flex flex-col gap-1">
          {validOptions.map(([key, { label, icon: Icon }]) => (
            <Button
              key={`effort-selector-${key}`}
              variant="ghost"
              className="w-full cursor-pointer justify-start p-0"
              onClick={() => handleChange(key as ReasoningEffort)}
            >
              <Icon className="size-5" />
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
