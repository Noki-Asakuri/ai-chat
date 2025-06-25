import { BrainIcon, ChevronRightIcon, EyeIcon, RefreshCcwIcon, RssIcon } from "lucide-react";
import * as React from "react";

import { Button, ButtonWithTip } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { AllModelIds, ModelsData, type ModelData, type Provider } from "@/lib/chat/models";
import { useChatRequest } from "@/lib/chat/send-chat-request";
import { useChatStore } from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

type RetryModelPopupProps = {
  index: number;
  message: ChatMessage;
};

type ModelWithId = ModelData & { modelId: string };
type GroupedModels = Partial<Record<Provider, ModelWithId[]>>;

type CapabilityIconProps = {
  children: React.ReactNode;
  variant: "webSearch" | "reasoning" | "vision";
  disable: boolean;
  title: string;
};

function CapabilityIcon({ children, variant, disable, title }: CapabilityIconProps) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <div
          className={cn("flex size-7 items-center justify-center rounded-md border", {
            "bg-[#25252e] *:stroke-[#94b8dc]": variant === "webSearch",
            "bg-[#252030] *:stroke-[#6a6aa2]": variant === "reasoning",
            "bg-[#252b2b] *:stroke-[#79afa3]": variant === "vision",
            hidden: !disable,
          })}
        >
          {children}
        </div>
      </TooltipTrigger>

      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}

export function RetryModelPopup({ index, message }: RetryModelPopupProps) {
  const { retryMessage } = useChatRequest();
  const [open, setOpen] = React.useState(false);

  const setPopupRetryMessageId = useChatStore((state) => state.setPopupRetryMessageId);

  const modelsByProvider = AllModelIds.reduce<GroupedModels>((acc, modelId) => {
    const model = ModelsData[modelId];
    const provider = model.provider;
    (acc[provider] ??= []).push({ modelId, ...model });

    return acc;
  }, {});

  function setPopupOpen(open: boolean) {
    setPopupRetryMessageId(open ? message._id : "");
    setOpen(open);
  }

  return (
    <Popover open={open} onOpenChange={setPopupOpen}>
      <PopoverTrigger asChild>
        <ButtonWithTip
          title="Retry Message"
          variant="ghost"
          className="size-10"
          disabled={message.status === "pending"}
        >
          <RefreshCcwIcon className="size-5" />
        </ButtonWithTip>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-2">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onMouseDown={async () => {
              setPopupOpen(false);
              await retryMessage(index);
            }}
          >
            <RefreshCcwIcon className="mr-2 size-4" />
            Retry same
          </Button>

          <div className="flex items-center justify-center gap-2 overflow-hidden">
            <Separator />
            <div className="shrink-0 text-center text-sm">or switch model</div>
            <Separator />
          </div>

          {Object.entries(modelsByProvider).map(([provider, models]) => {
            return (
              <Popover key={provider}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start">
                    <Icons.provider provider={provider as Provider} />
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    <ChevronRightIcon className="ml-auto size-4" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  side="right"
                  align="start"
                  className="w-min min-w-82 p-2"
                  sideOffset={16}
                >
                  <div className="space-y-1">
                    {models?.map((model) => (
                      <ModelProviderPicker
                        key={model.modelId}
                        provider={model.provider}
                        model={model}
                        index={index}
                        retryMessage={async () => {
                          setPopupOpen(false);
                          await retryMessage(index, { modelId: model.modelId });
                        }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ModelProviderPickerProps = {
  provider: Provider;
  model: ModelWithId;
  index: number;

  retryMessage: () => Promise<void>;
};

function ModelProviderPicker(props: ModelProviderPickerProps) {
  return (
    <Button
      variant="ghost"
      className="w-full items-center justify-between gap-2 px-3"
      onMouseDown={async () => {
        await props.retryMessage();
      }}
    >
      <div className="flex items-center gap-2">
        <Icons.provider provider={props.model.provider} />
        <span className="truncate">{props.model.displayName}</span>
      </div>

      <div className="flex items-center gap-1">
        <CapabilityIcon
          variant="webSearch"
          disable={props.model.capabilities.webSearch}
          title="This model supports web search."
        >
          <RssIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="reasoning"
          disable={props.model.capabilities.reasoning !== false}
          title="This model supports reasoning."
        >
          <BrainIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="vision"
          disable={props.model.capabilities.vision}
          title="This model supports vision."
        >
          <EyeIcon size={16} />
        </CapabilityIcon>
      </div>
    </Button>
  );
}
