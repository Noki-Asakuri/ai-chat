import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useParams } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreApi, useConfigStoreState } from "../provider/config-provider";
import { Button, buttonVariants } from "../ui/button";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "../ui/popover";

import { getDefaultReasoning, getReasoningOptions, tryGetModelData } from "@/lib/chat/models";
import { useSyncThreadModelConfig } from "@/lib/chat/server-function/sync-thread-model-config";
import type { ReasoningEffort } from "@/lib/types";
import { cn, fromUUID } from "@/lib/utils";

import { clearEffortIntent, createEffortIntent } from "@/lib/store/config-store";

import { REASONING_OPTIONS } from "./reasoning-options";

const EFFORT_SYNC_DEBOUNCE_MS = 1_000;

type ReasoningPickerProps = {
  value: ReasoningEffort;
  model: string;
  onChange?: (effort: ReasoningEffort) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
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
  const configStoreApi = useConfigStoreApi();
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const { syncThreadModelConfig } = useSyncThreadModelConfig();

  // Each choice records an effort intent (see `EffortIntent`) and queues a debounced save for it.
  // The save carries its thread and store, so one that lands after switching threads still updates
  // the thread it was chosen in. It runs only if its intent is still the current one: a model
  // selection carries the choice forward itself, and a server model switch discards it. Only the
  // effort is sent, and only if the thread still uses that model. Unmounting sends it at once.
  const syncEffort = useDebouncedCallback(
    (pending: { threadId: Id<"threads">; store: typeof configStoreApi; intentId: number }) => {
      const state = pending.store.getState();
      const intent = state.effortIntent;
      if (intent?.id !== pending.intentId || !intent.queued) return;
      if (state.model !== intent.model) {
        state.setEffortIntent(null);
        return;
      }

      state.setEffortIntent({ ...intent, queued: false });
      void syncThreadModelConfig({
        threadId: pending.threadId,
        modelParams: { effort: intent.effort },
        expectedModel: intent.model,
        onFailure: () => clearEffortIntent(pending.store, intent.id),
      });
    },
    { wait: EFFORT_SYNC_DEBOUNCE_MS, onUnmount: (debouncer) => debouncer.flush() },
  );

  const validOptions = getReasoningOptions(modelData);

  function handleChange(effort: ReasoningEffort) {
    if (props.onChange) {
      props.onChange(effort);
      return;
    }

    configStore.setModelParams({ effort });

    const threadId = fromUUID<Id<"threads">>(params?.threadId);
    if (!threadId) return;

    const intent = createEffortIntent(props.model, effort, true);
    configStore.setEffortIntent(intent);
    syncEffort({ threadId, store: configStoreApi, intentId: intent.id });
  }

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
