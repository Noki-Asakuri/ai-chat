import {
  ChevronRightIcon,
  RefreshCcwIcon,
  SignalHighIcon,
  SignalLowIcon,
  SignalMediumIcon,
} from "lucide-react";
import * as React from "react";

import { ModelCapability } from "@/components/capability-icon";
import { buttonVariants, ButtonWithTip, type Button } from "@/components/ui/button";
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
import type { ChatMessage, ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";

type RetryModelPopupProps = React.ComponentPropsWithoutRef<typeof Button> & {
  index: number;
  message: ChatMessage;
};

type ModelWithId = ModelData & { modelId: string };
type GroupedModels = Partial<Record<Provider, ModelWithId[]>>;

export function MessageRetryMenu({ index, message, ...props }: RetryModelPopupProps) {
  const { retryMessage } = useChatRequest();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const pendingRetry = isPending || message.status === "pending";

  const modelsByProvider = AllModelIds.reduce<GroupedModels>((acc, modelId) => {
    const model = ModelsData[modelId]!;
    const provider = model.provider;
    (acc[provider] ??= []).push({ modelId, ...model });

    return acc;
  }, {});

  function setPopupOpen(open: boolean) {
    useChatStore.getState().setPopupRetryMessageId(open ? message._id : "");
    setOpen(open);
  }

  // Left click: immediately retry with the same model.
  function handleMouseDown(event: React.MouseEvent<HTMLButtonElement>) {
    if (pendingRetry) return;

    // 0 = primary/left button
    if (event.button === 0) {
      event.preventDefault();
      event.stopPropagation();

      startTransition(async () => {
        await retryMessage(index, { modelId: message.model, effort: message.modelParams?.effort });
      });
    }
  }

  // Right click: show the retry menu (model picker).
  function handleContextMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (pendingRetry) return;

    event.preventDefault();
    event.stopPropagation();
    setPopupOpen(true);
  }

  return (
    <Menu.Root
      open={open}
      onOpenChange={function onChangeOpen(open, eventDetails) {
        // Prevent BaseUI Menu from opening on left-click; we control open state manually.
        if (eventDetails.reason === "trigger-press") {
          eventDetails.cancel();
          return;
        }

        setPopupOpen(open);
      }}
    >
      <Menu.Trigger
        title="Retry Message"
        render={<ButtonWithTip side="bottom" variant="ghost" />}
        disabled={pendingRetry}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        {...props}
      >
        <RefreshCcwIcon className="size-4" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner className="outline-none" sideOffset={8} align="center" side="top">
          <Menu.Popup className="flex w-50 origin-[var(--transform-origin)] flex-col gap-1 rounded-md border bg-card p-1 text-card-foreground transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[starting-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <MenuArrow className="fill-card" />

            <Menu.Item
              className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}
              onClick={async () => {
                setPopupOpen(false);
                await retryMessage(index, {
                  modelId: message.model,
                  effort: message.modelParams?.effort,
                });
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
                      <Menu.Popup className="flex w-max origin-[var(--transform-origin)] flex-col gap-1 rounded-md border bg-card p-1 text-card-foreground transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[starting-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
                        <MenuArrow className="fill-card" />

                        {models?.map((model) => (
                          <ModelProviderPicker
                            key={model.modelId}
                            model={model}
                            index={index}
                            provider={model.provider}
                            messageRole={message.role}
                            retryMessage={async (effort) => {
                              setPopupOpen(false);
                              await retryMessage(index, { modelId: model.modelId, effort });
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
  messageRole: ChatMessage["role"];

  retryMessage: (effort?: ReasoningEffort) => Promise<void>;
};

function ModelProviderPicker(props: ModelProviderPickerProps) {
  if (props.model.capabilities.reasoning === true) {
    return <EffortSelector {...props} />;
  }

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

      <ModelCapability model={props.model} />
    </Menu.Item>
  );
}

function EffortSelector(props: ModelProviderPickerProps) {
  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "w-full items-center justify-between gap-4 p-2",
        )}
      >
        <div className="pointer-events-none flex items-center gap-2">
          <Icons.provider provider={props.model.provider} />
          <span className="w-max">{props.model.display.unique ?? props.model.display.name}</span>
        </div>

        <ModelCapability model={props.model} />
      </Menu.SubmenuTrigger>

      <Menu.Portal>
        <Menu.Positioner
          align="center"
          className="p-1"
          sideOffset={12}
          side={props.messageRole === "user" ? "left" : "right"}
        >
          <Menu.Popup className="flex w-max origin-[var(--transform-origin)] flex-col gap-1 rounded-md border bg-card p-1 text-card-foreground transition-[transform,scale,opacity] data-[ending-style]:scale-90 data-[starting-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <MenuArrow className="fill-card" />

            <div className="flex flex-col gap-1">
              <Menu.Item
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full cursor-pointer justify-start p-0",
                )}
                onClick={() => props.retryMessage("low")}
              >
                <SignalLowIcon className="size-5" />
                Low
              </Menu.Item>

              <Menu.Item
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full cursor-pointer justify-start p-0",
                )}
                onClick={() => props.retryMessage("medium")}
              >
                <SignalMediumIcon className="size-5" />
                Medium
              </Menu.Item>

              <Menu.Item
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full cursor-pointer justify-start p-0",
                )}
                onClick={() => props.retryMessage("high")}
              >
                <SignalHighIcon className="size-5" />
                High
              </Menu.Item>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}
