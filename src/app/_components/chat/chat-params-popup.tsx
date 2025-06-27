import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { ButtonWithTip } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Slider } from "../ui/slider";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { NumberInput } from "../ui/number-input";

export function ChatParamsPopup() {
  const config = useChatStore((state) => state.chatConfig);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  const modelConfig = getModelData(config.model);

  return (
    <Popover>
      <PopoverTrigger
        render={ButtonWithTip}
        type="button"
        // @ts-expect-error BaseUI doesn't forward props correctly
        variant="secondary"
        className="group size-9 border px-2 py-1.5 text-xs"
        title="Adjust Parameters"
      >
        <SettingsIcon className="transition-colors" />
        <span className="sr-only">Adjust Parameters</span>
      </PopoverTrigger>

      <PopoverContent align="center" sideOffset={10} className="w-80 px-4 pt-3 pb-5">
        <div className="flex flex-col gap-4">
          <ParameterSlider
            label="Temperature"
            value={config.temperature}
            min={0}
            max={2}
            step={0.01}
            onChange={(value) => setChatConfig({ temperature: value })}
            hidden={!modelConfig.capabilities.config.temperature}
          />
          <ParameterSlider
            label="Top P"
            value={config.topP}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => setChatConfig({ topP: value })}
            hidden={!modelConfig.capabilities.config.topP}
          />
          <ParameterSlider
            label="Top K"
            value={config.topK}
            min={1}
            max={100}
            step={1}
            onChange={(value) => setChatConfig({ topK: value })}
            hidden={!modelConfig.capabilities.config.topP}
          />
          <ParameterSlider
            label="Presence Penalty"
            value={config.presencePenalty}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => setChatConfig({ presencePenalty: value })}
            hidden={!modelConfig.capabilities.config.presencePenalty}
          />
          <ParameterSlider
            label="Frequency Penalty"
            value={config.frequencyPenalty}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) => setChatConfig({ frequencyPenalty: value })}
            hidden={!modelConfig.capabilities.config.frequencyPenalty}
          />
          <ParameterSlider
            label="Max Tokens"
            value={config.maxTokens}
            min={1024}
            max={modelConfig.capabilities.maxTokens}
            step={128}
            onChange={(value) => setChatConfig({ maxTokens: value })}
          />

          {modelConfig.capabilities.reasoning === "effort" && <OptionReasoning />}
          {modelConfig.capabilities.reasoning === "budget" && (
            <SliderReasoning
              min={modelConfig.capabilities.budgetLimit!.min}
              max={modelConfig.capabilities.budgetLimit!.max}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ParameterSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  hidden?: boolean;
};

function ParameterSlider({ label, value, min, max, step, hidden, onChange }: ParameterSliderProps) {
  const [inputValue, setInputValue] = useState(value);

  return (
    <div hidden={hidden} className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>

        <NumberInput
          value={inputValue}
          max={max}
          min={min}
          step={step}
          onValueChange={(rawValue) => {
            if (!rawValue) return;

            const value = Math.max(min, Math.min(max, rawValue));
            setInputValue(value);
            onChange(value);
          }}
        />
      </div>

      <Slider
        value={[inputValue]}
        min={min}
        max={max}
        step={step}
        onValueChange={([val]) => setInputValue(val!)}
        onValueCommit={([val]) => onChange(val!)}
      />
    </div>
  );
}

function SliderReasoning({ min, max }: { min: number; max: number }) {
  const maxTokens = useChatStore((state) => state.chatConfig.maxTokens);
  const thinkingBudget = useChatStore((state) => state.chatConfig.thinkingBudget);

  const setChatConfig = useChatStore((state) => state.setChatConfig);

  const [localBudget, setBudget] = useState(thinkingBudget);
  const maxBudget = Math.floor(maxTokens * 0.8);

  useEffect(() => {
    if (localBudget > maxBudget) setBudget(maxBudget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxBudget]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Thinking Budget</span>

        <NumberInput
          value={localBudget}
          max={max}
          min={min}
          onValueChange={(rawValue) => {
            if (!rawValue) return;

            const value = Math.max(min, Math.min(max, rawValue));
            setBudget(value);
            setChatConfig({ thinkingBudget: value });
          }}
        />
      </div>

      <Slider
        min={min}
        max={max}
        step={128}
        id="reasoning-slider"
        value={[localBudget]}
        onValueChange={([value]) => {
          const v = Math.max(min, Math.min(max, value!, maxBudget));
          setBudget(v);
        }}
        onValueCommit={([value]) => setChatConfig({ thinkingBudget: value! })}
      />

      <p className="text-muted-foreground text-center text-xs text-balance">
        Thinking budget can not exceed 80% of max tokens.
      </p>
    </div>
  );
}

function OptionReasoning() {
  const reasoningEffort = useChatStore((state) => state.chatConfig.reasoningEffort);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  const reasoningEfforts = ["low", "medium", "high"] as const;

  return (
    <div className="flex flex-col gap-4">
      <span className="text-sm font-medium">
        Thinking Budget: <span className="capitalize">{reasoningEffort}</span>
      </span>

      <div className="grid grid-cols-1 gap-2">
        <Slider
          min={1}
          max={3}
          step={1}
          id="reasoning-slider"
          defaultValue={[reasoningEfforts.indexOf(reasoningEffort) + 1]}
          onValueChange={([value]) =>
            setChatConfig({ reasoningEffort: reasoningEfforts[value! - 1]! })
          }
        />

        <div className="text-muted-foreground -mx-1.5 mt-2 flex items-center justify-between text-xs">
          {reasoningEfforts.map((effort) => (
            <span key={effort} className="capitalize">
              {effort}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
