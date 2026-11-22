import { ChevronDownIcon } from "lucide-react";

import { Button, buttonVariants } from "../ui/button";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "../ui/popover";

import { useComposerModelConfig } from "@/lib/chat/composer-model-config";
import { getDefaultReasoning, getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import type { ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

import { REASONING_OPTIONS } from "./reasoning-options";

type ReasoningPickerProps = {
  value: ReasoningEffort;
  model: string;
  onChange: (effort: ReasoningEffort) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export function ChatReasoningPicker() {
  const { config, update } = useComposerModelConfig();

  return (
    <ReasoningPickerBase
      value={config.modelParams.effort}
      model={config.model}
      onChange={(effort) => void update({ effort })}
    />
  );
}

export function ReasoningPicker(props: ReasoningPickerProps) {
  return <ReasoningPickerBase {...props} />;
}

type ReasoningPickerBaseInnerProps = ReasoningPickerProps & {
  modelData: NonNullable<ReturnType<typeof tryGetModelData>>;
};

export function ReasoningPickerBase(props: ReasoningPickerProps) {
  const modelData = tryGetModelData(props.model);
  if (!modelData) return null;

  return <ReasoningPickerBaseInner {...props} modelData={modelData} />;
}

function ReasoningPickerBaseInner({ modelData, ...props }: ReasoningPickerBaseInnerProps) {
  const validOptions = getReasoningOptions(modelData);

  if (validOptions.length === 0) return null;
  const value = validOptions.includes(props.value) ? props.value : getDefaultReasoning(modelData);

  return (
    <Popover>
      <PopoverTrigger
        disabled={props.disabled}
        aria-label={props.ariaLabel ?? "Reasoning effort"}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "surface-edge flex h-9 cursor-pointer items-center justify-between gap-2 border border-border px-2 py-1.5 capitalize hover:bg-primary/15!",
          props.className,
        )}
      >
        {REASONING_OPTIONS[value].label}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent
        className="w-max rounded-md bg-card p-1 text-card-foreground"
        includeArrow={false}
        sideOffset={8}
      >
        <PopoverArrow className="fill-card" />

        <div className="flex flex-col gap-1">
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Reasoning</p>

          {validOptions.map((key) => {
            const { label } = REASONING_OPTIONS[key];
            return (
              <Button
                key={`reasoning-picker-${key}`}
                variant="ghost"
                size="default"
                className="w-full cursor-pointer justify-start"
                onClick={() => props.onChange(key)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
