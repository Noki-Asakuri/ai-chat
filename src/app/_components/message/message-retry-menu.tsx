import { BrainIcon, ChevronRightIcon, EyeIcon, RefreshCcwIcon, RssIcon } from "lucide-react";
import * as React from "react";

import { CapabilityIcon } from "@/components/capability-icon";
import { Button, buttonVariants, ButtonWithTip } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Menu, MenuArrow } from "@/components/ui/menu";
import { Separator } from "@/components/ui/separator";

import {
  AllModelIds,
  ModelsData,
  prettifyProviderName,
  type ModelData,
  type Provider,
} from "@/lib/chat/models";
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

export function MessageRetryMenu({ index, message }: RetryModelPopupProps) {
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
    <Menu.Root open={open} onOpenChange={setPopupOpen}>
      <Menu.Trigger
        render={ButtonWithTip}
        // @ts-expect-error BaseUI doesn't forward props correctly
        side="bottom"
        variant="ghost"
        title="Retry Message"
        className="size-10"
        disabled={message.status === "pending"}
      >
        <RefreshCcwIcon className="size-5" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner className="outline-none" sideOffset={8} align="center" side="top">
          <Menu.Popup className="bg-popover text-popover-foreground flex w-50 origin-[var(--transform-origin)] flex-col gap-1 rounded-md border p-1 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
            <MenuArrow className="fill-popover" />

            <Menu.Item
              className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
              onClick={async () => {
                setPopupOpen(false);
                await retryMessage(index, { modelId: message.model });
              }}
            >
              <RefreshCcwIcon className="size-4" />
              <span className="pointer-events-none">Retry same</span>
            </Menu.Item>

            <div className="flex items-center justify-center gap-2 overflow-hidden">
              <Separator />
              <div className="shrink-0 text-center text-sm">or switch model</div>
              <Separator />
            </div>

            {Object.entries(modelsByProvider).map(([provider, models]) => {
              return (
                <Menu.SubmenuRoot key={provider}>
                  <Menu.SubmenuTrigger
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "flex w-full justify-start",
                    )}
                  >
                    <Icons.provider provider={provider as Provider} />
                    <span className="pointer-events-none">{prettifyProviderName(provider)}</span>
                    <ChevronRightIcon className="ml-auto size-4" />
                  </Menu.SubmenuTrigger>

                  <Menu.Portal>
                    <Menu.Positioner side="right" align="center" className="p-1" sideOffset={12}>
                      <Menu.Popup className="bg-popover text-popover-foreground flex w-max origin-[var(--transform-origin)] flex-col gap-1 rounded-md border p-1 transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0">
                        <MenuArrow className="fill-popover" />

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
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
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
    <Menu.Item
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "w-full items-center justify-between gap-4 p-2",
      )}
      onClick={async () => await props.retryMessage()}
    >
      <div className="pointer-events-none flex items-center gap-2">
        <Icons.provider provider={props.model.provider} />
        <span className="w-max">{props.model.display.unique ?? props.model.display.name}</span>
      </div>

      <div className="flex items-center gap-1">
        <CapabilityIcon
          variant="webSearch"
          enabled={props.model.capabilities.webSearch}
          title="This model supports web search."
        >
          <RssIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="reasoning"
          enabled={props.model.capabilities.reasoning !== false}
          title="This model supports reasoning."
        >
          <BrainIcon size={16} />
        </CapabilityIcon>

        <CapabilityIcon
          variant="vision"
          enabled={props.model.capabilities.vision}
          title="This model supports vision."
        >
          <EyeIcon size={16} />
        </CapabilityIcon>
      </div>
    </Menu.Item>
  );
}
