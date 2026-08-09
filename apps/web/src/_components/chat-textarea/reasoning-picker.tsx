import { useDebounce } from "@uidotdev/usehooks";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "../provider/config-provider";
import { Button, buttonVariants } from "../ui/button";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "../ui/popover";

import { getDefaultReasoning, getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useSyncThreadModelConfig } from "@/lib/chat/server-function/sync-thread-model-config";
import type { ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

const EFFORT_SYNC_DEBOUNCE_MS = 1_000;

type ReasoningPickerProps = {
  value: ReasoningEffort;
  model: string;
  onChange?: (effort: ReasoningEffort) => void;
  className?: string;
};

export function ChatReasoningPicker() {
  const config = useConfigStore(
    useShallow((state) => ({ effort: state.modelParams.effort, model: state.model })),
  );
  return <ReasoningPickerBase value={config.effort} model={config.model} />;
}

export function ReasoningPicker(props: ReasoningPickerProps) {
  return <ReasoningPickerBase {...props} />;
}

export const REASONING_OPTIONS: Record<ReasoningEffort, { label: string }> = {
  none: { label: "None" },
  minimal: { label: "Minimal" },
  low: { label: "Low" },
  medium: { label: "Medium" },
  high: { label: "High" },
  xhigh: { label: "XHigh" },
  max: { label: "Max" },
};

type ReasoningPickerBaseInnerProps = ReasoningPickerProps & {
  modelData: NonNullable<ReturnType<typeof tryGetModelData>>;
};

export function ReasoningPickerBase(props: ReasoningPickerProps) {
  const modelData = tryGetModelData(props.model);
  if (!modelData) return null;

  return <ReasoningPickerBaseInner {...props} modelData={modelData} />;
}

function ReasoningPickerBaseInner({ modelData, ...props }: ReasoningPickerBaseInnerProps) {
  const configStore = useConfigStoreState();
  const { syncThreadModelConfig } = useSyncThreadModelConfig();

  const [pendingSyncEffort, setPendingSyncEffort] = useState<ReasoningEffort | null>(null);
  const debouncedSyncEffort = useDebounce(pendingSyncEffort, EFFORT_SYNC_DEBOUNCE_MS);

  const validOptions = getReasoningOptions(modelData);

  const handleChange = useEffectEvent((effort: ReasoningEffort) => {
    if (props.onChange) {
      props.onChange(effort);
      return;
    }

    configStore.setModelParams({ effort });
    setPendingSyncEffort(effort);
  });

  const syncPendingEffort = useEffectEvent((effort: ReasoningEffort) => {
    void syncThreadModelConfig({
      model: props.model,
      modelParams: { effort },
    });
  });

  useEffect(() => {
    if (validOptions.length > 0 && !validOptions.includes(props.value)) {
      handleChange(getDefaultReasoning(modelData));
    }
  }, [modelData, props.value, validOptions]);

  useEffect(() => {
    if (debouncedSyncEffort === null) return;

    syncPendingEffort(debouncedSyncEffort);
  }, [debouncedSyncEffort]);

  if (validOptions.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "surface-edge flex h-9 cursor-pointer items-center justify-between gap-2 border border-border px-2 py-1.5 capitalize hover:bg-primary/15!",
          props.className,
        )}
      >
        {props.value}
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
                onClick={() => handleChange(key)}
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
