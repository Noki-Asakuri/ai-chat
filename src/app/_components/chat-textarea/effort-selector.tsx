import { BrainIcon, SignalHighIcon, SignalLowIcon, SignalMediumIcon } from "lucide-react";

import { Button, buttonVariants } from "../ui/button";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "../ui/popover";

import { getModelData } from "@/lib/chat/models";
import { useChatStore } from "@/lib/chat/store";
import type { ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

type EffortSelectorProps = {
  value: string;
  modelId: string;
  onChange?: (effort: ReasoningEffort) => void;
};

export function ChatEffortSelector() {
  const config = useChatStore((state) => state.chatConfig);
  return <EffortSelectorBase value={config.effort} modelId={config.model} />;
}

export function EffortSelector(props: EffortSelectorProps) {
  return <EffortSelectorBase {...props} />;
}

export function EffortSelectorBase(props: EffortSelectorProps) {
  const setChatConfig = useChatStore((state) => state.setChatConfig);
  const modelData = getModelData(props.modelId);

  function handleChange(effort: ReasoningEffort) {
    if (props.onChange) props.onChange(effort);
    else setChatConfig({ effort });
  }

  if (
    typeof modelData.capabilities.reasoning === "undefined" ||
    modelData.capabilities.reasoning === "always" ||
    modelData.capabilities.reasoning === false
  ) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "hover:!bg-primary/15 flex h-9 cursor-pointer items-center justify-between gap-2 border px-2 py-1.5 text-xs capitalize",
          buttonVariants({ variant: "ghost" }),
        )}
      >
        <BrainIcon className="size-4" />
        {props.value}
      </PopoverTrigger>

      <PopoverContent className="bg-card text-card-foreground w-max p-1" includeArrow={false}>
        <PopoverArrow className="fill-card" />

        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="w-full cursor-pointer justify-start p-0"
            onClick={() => handleChange("low")}
          >
            <SignalLowIcon className="size-5" />
            Low
          </Button>

          <Button
            variant="ghost"
            className="w-full cursor-pointer justify-start p-0"
            onClick={() => handleChange("medium")}
          >
            <SignalMediumIcon className="size-5" />
            Medium
          </Button>

          <Button
            variant="ghost"
            className="w-full cursor-pointer justify-start p-0"
            onClick={() => handleChange("high")}
          >
            <SignalHighIcon className="size-5" />
            High
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
