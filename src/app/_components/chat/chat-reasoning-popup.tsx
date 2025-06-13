import { BrainIcon } from "lucide-react";
import { useState } from "react";

import { ButtonWithTip } from "../ui/button";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Slider } from "../ui/slider";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import { cn, format } from "@/lib/utils";
import { Input } from "../ui/input";

export function ChatReasoningPopup() {
  const config = useChatStore((state) => state.chatConfig);

  const modelConfig = getModelData(config.model)?.capabilities.reasoning;

  if (!modelConfig) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ButtonWithTip
          type="button"
          variant="secondary"
          className="size-9 border px-2 py-1.5 text-xs data-[active=true]:border-yellow-400 data-[active=true]:bg-yellow-500/15"
          data-active={config.reasoning !== false || modelConfig === "always"}
          title={
            modelConfig === "always"
              ? "Reasoning is always enabled for this model."
              : modelConfig === "options"
                ? "Change Reasoning Effort"
                : "Change Thinking Budget"
          }
        >
          <BrainIcon
            className={cn("transition-colors", { "stroke-yellow-400": config.reasoning })}
          />
          <span className="sr-only">
            {config.reasoning ? "Disable Reasoning" : "Enable Reasoning"}
          </span>
        </ButtonWithTip>
      </PopoverTrigger>

      <PopoverContent align="start" className="min-w-max p-2" hidden={modelConfig === "always"}>
        {modelConfig === "options" && <OptionReasoning />}
        {typeof modelConfig === "object" && modelConfig.type === "slider" && (
          <SliderReasoning min={modelConfig.min} max={modelConfig.max} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function SliderReasoning({ min, max }: { min: number; max: number }) {
  const reasoning = useChatStore((state) => state.chatConfig.reasoning);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  const [value, setValue] = useState<number[]>(typeof reasoning === "number" ? [reasoning] : [min]);

  return (
    <div className="flex flex-col gap-4 px-4 py-2">
      <span>Thinking Budget: {format.number(value[0]!)}</span>
      <div className="grid grid-cols-[3fr_1fr] gap-2">
        <div className="flex flex-col justify-center gap-2">
          <Slider
            min={min}
            max={max}
            step={128}
            id="reasoning-slider"
            className=""
            defaultValue={value}
            onValueChange={(value) => setValue(value)}
            onValueCommit={(value) => setChatConfig({ reasoning: value[0] })}
          />

          <div className="text-muted-foreground mt-1 flex justify-between text-xs font-medium">
            <span>{format.number(min)}</span>
            <span>{format.number(max)}</span>
          </div>
        </div>

        <input
          type="number"
          value={value[0]}
          className="w-20 appearance-none rounded-md border p-2 text-sm outline-none"
          onChange={(event) => {
            const value = Number(event.target.value);
            if (isNaN(value) || value < min || value > max) return;
            setValue([value]);
            setChatConfig({ reasoning: value });
          }}
        />
      </div>
    </div>
  );
}

function OptionReasoning() {
  const reasoning = useChatStore((state) => state.chatConfig.reasoning);
  const setChatConfig = useChatStore((state) => state.setChatConfig);

  const reasoningEfforts = ["low", "medium", "high"];

  const [value, setValue] = useState<"low" | "medium" | "high">(
    typeof reasoning === "string" ? reasoning : "medium",
  );

  return (
    <div className="flex flex-col gap-4 px-4 py-2">
      <span>
        Thinking Budget: <span className="capitalize">{value}</span>
      </span>

      <div className="grid grid-cols-1 gap-2">
        <Slider
          min={1}
          max={3}
          step={1}
          id="reasoning-slider"
          className=""
          defaultValue={[value === "low" ? 1 : value === "medium" ? 2 : 3]}
          onValueChange={(value) =>
            setValue(value[0] === 1 ? "low" : value[0] === 2 ? "medium" : "high")
          }
          onValueCommit={() => setChatConfig({ reasoning: value })}
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
