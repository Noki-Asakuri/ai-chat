import { LayersIcon, RefreshCcwIcon, SearchIcon, StarIcon } from "lucide-react";
import * as React from "react";

import { useConfigStore } from "@/components/provider/config-provider";

import { ModelCapability } from "@/components/capability-icon";
import { buttonVariants, ButtonWithTip, type Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Menu, MenuArrow } from "@/components/ui/menu";

import {
  SelectableModelIds,
  prettifyProviderName,
  tryGetModelData,
  type ModelData,
  type Provider,
} from "@/lib/chat/models";
import { useRetryChatMessage } from "@/lib/chat/server-function/retry-chat-message";
import { useMessageStore } from "@/lib/store/messages-store";
import type { ChatMessage, ReasoningEffort } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EFFORT_OPTIONS } from "../chat-textarea/effort-selector";

type RetryModelPopupProps = React.ComponentPropsWithoutRef<typeof Button> & {
  userMessageId: ChatMessage["_id"];
  message: ChatMessage;
};

type PickerSectionKey = "all" | "favorites" | Provider;

type RetryModelEntry = {
  id: string;
  label: string;
  provider: Provider;
  data: ModelData;
};

type ProviderModels = Record<Provider, Array<RetryModelEntry>>;

type ModelGroup = {
  key: string;
  title: string;
  models: Array<RetryModelEntry>;
};

type EffortOption = {
  effort: ReasoningEffort;
  label: string;
  icon: (typeof EFFORT_OPTIONS)[ReasoningEffort]["icon"];
};

const PROVIDER_ORDER: Array<Provider> = ["google", "openai", "deepseek"];
const DEFAULT_REASONING_EFFORTS = new Set<ReasoningEffort>(["low", "medium", "high"]);
const EFFORT_ORDER: Array<ReasoningEffort> = ["none", "minimal", "low", "medium", "high", "xhigh"];

function createEmptyProviderModels(): ProviderModels {
  return { google: [], openai: [], deepseek: [] };
}

function sortEntriesByLabel(a: RetryModelEntry, b: RetryModelEntry): number {
  return a.label.localeCompare(b.label);
}

function groupProviderModels(models: Array<RetryModelEntry>): ProviderModels {
  const grouped = createEmptyProviderModels();

  for (const model of models) {
    grouped[model.provider].push(model);
  }

  for (const provider of PROVIDER_ORDER) {
    grouped[provider].sort(sortEntriesByLabel);
  }

  return grouped;
}

function appendProviderGroups(
  groups: Array<ModelGroup>,
  providerModels: ProviderModels,
  options?: {
    keyPrefix?: string;
    titleSuffix?: string;
  },
) {
  for (const provider of PROVIDER_ORDER) {
    const models = providerModels[provider];
    if (models.length === 0) continue;

    const title = prettifyProviderName(provider);

    groups.push({
      key: options?.keyPrefix ? `${options.keyPrefix}-${provider}` : provider,
      title: options?.titleSuffix ? `${title} ${options.titleSuffix}` : title,
      models,
    });
  }
}

function getValidReasoningEffortOptions(model: ModelData): Array<EffortOption> {
  const allowedEfforts = model.capabilities.customReasoningLevel;
  const options: Array<EffortOption> = [];

  for (const effort of EFFORT_ORDER) {
    const effortOption = EFFORT_OPTIONS[effort];
    if (!effortOption) continue;

    if (allowedEfforts) {
      if (!allowedEfforts.includes(effort)) continue;
    } else if (!DEFAULT_REASONING_EFFORTS.has(effort)) {
      continue;
    }

    options.push({ effort, label: effortOption.label, icon: effortOption.icon });
  }

  return options;
}

export function MessageRetryMenu({ userMessageId, message, ...props }: RetryModelPopupProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedSection, setSelectedSection] = React.useState<PickerSectionKey>("all");
  const [query, setQuery] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const hiddenModels = useConfigStore((state) => state.hiddenModels);
  const favoriteModels = useConfigStore((state) => state.favoriteModels);

  const currentModelIdFromStore = useMessageStore((state) => {
    const activeAssistantMessageId =
      state.activeAssistantMessageIdByUserMessageId[userMessageId] ??
      state.variantMessageIdsByUserMessageId[userMessageId]?.at(-1);

    if (!activeAssistantMessageId) return "";

    const activeAssistantMessage = state.messagesById[activeAssistantMessageId];
    if (!activeAssistantMessage || activeAssistantMessage.role !== "assistant") return "";

    return activeAssistantMessage.metadata?.model.request ?? "";
  });

  const currentModelId =
    currentModelIdFromStore.length > 0
      ? currentModelIdFromStore
      : message.role === "assistant"
        ? (message.metadata?.model.request ?? "")
        : "";

  const { retryChatMessage } = useRetryChatMessage();

  const pendingRetry = isPending || message.status === "pending";

  const selectableModels = React.useMemo(() => {
    const next: Array<RetryModelEntry> = [];

    for (const modelId of SelectableModelIds) {
      const data = tryGetModelData(modelId);
      if (!data) continue;

      next.push({
        id: modelId,
        label: data.display.unique ?? data.display.name,
        provider: data.provider,
        data,
      });
    }

    next.sort(sortEntriesByLabel);
    return next;
  }, []);

  const visibleModels = React.useMemo(() => {
    const hiddenSet = new Set<string>(hiddenModels);

    return selectableModels.filter((model) => !hiddenSet.has(model.id));
  }, [hiddenModels, selectableModels]);

  const normalizedQuery = query.trim().toLowerCase();

  const searchableVisibleModels = React.useMemo(() => {
    if (normalizedQuery.length === 0) return visibleModels;

    return visibleModels.filter((model) => {
      const providerName = prettifyProviderName(model.provider).toLowerCase();
      return (
        model.label.toLowerCase().includes(normalizedQuery) ||
        model.provider.toLowerCase().includes(normalizedQuery) ||
        providerName.includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, visibleModels]);

  const searchableAllModels = React.useMemo(() => {
    if (normalizedQuery.length === 0) return selectableModels;

    return selectableModels.filter((model) => {
      const providerName = prettifyProviderName(model.provider).toLowerCase();
      return (
        model.label.toLowerCase().includes(normalizedQuery) ||
        model.provider.toLowerCase().includes(normalizedQuery) ||
        providerName.includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, selectableModels]);

  const visibleProviderModels = React.useMemo(
    () => groupProviderModels(searchableVisibleModels),
    [searchableVisibleModels],
  );

  const searchableVisibleModelById = React.useMemo(() => {
    const byId = new Map<string, RetryModelEntry>();

    for (const model of searchableVisibleModels) {
      byId.set(model.id, model);
    }

    return byId;
  }, [searchableVisibleModels]);

  const searchableFavoriteModels = React.useMemo(() => {
    const next: Array<RetryModelEntry> = [];
    const seen = new Set<string>();

    for (const modelId of favoriteModels) {
      if (seen.has(modelId)) continue;
      seen.add(modelId);

      const model = searchableVisibleModelById.get(modelId);
      if (!model) continue;

      next.push(model);
    }

    return next;
  }, [favoriteModels, searchableVisibleModelById]);

  const favoriteProviderModels = React.useMemo(
    () => groupProviderModels(searchableFavoriteModels),
    [searchableFavoriteModels],
  );

  const allProviderModels = React.useMemo(
    () => groupProviderModels(searchableAllModels),
    [searchableAllModels],
  );

  const groups = React.useMemo(() => {
    const next: Array<ModelGroup> = [];

    if (selectedSection === "all") {
      appendProviderGroups(next, visibleProviderModels);
      return next;
    }

    if (selectedSection === "favorites") {
      appendProviderGroups(next, favoriteProviderModels, {
        keyPrefix: "favorites",
        titleSuffix: "Favorites",
      });
      return next;
    }

    const selectedProviderModels = allProviderModels[selectedSection];
    if (selectedProviderModels.length > 0) {
      next.push({
        key: selectedSection,
        title: prettifyProviderName(selectedSection),
        models: selectedProviderModels,
      });
    }

    return next;
  }, [allProviderModels, favoriteProviderModels, selectedSection, visibleProviderModels]);

  const emptyMessage = React.useMemo(() => {
    if (selectedSection === "favorites") {
      if (normalizedQuery.length > 0) return "No favorite models match your search.";
      return "No favorite models yet.";
    }

    if (normalizedQuery.length > 0) return "No models match your search.";
    return "No models available.";
  }, [normalizedQuery.length, selectedSection]);

  React.useEffect(() => {
    if (open) return;

    setSelectedSection("all");
    setQuery("");
  }, [open]);

  function runRetry(options?: {
    modelId?: string;
    modelParams?: Partial<NonNullable<ChatMessage["metadata"]>["modelParams"]>;
  }) {
    if (pendingRetry) return;

    setOpen(false);

    startTransition(async () => {
      await retryChatMessage({ userMessageId, ...options });
    });
  }

  function handleSelectModel(model: RetryModelEntry) {
    if (pendingRetry) return;
    runRetry({ modelId: model.id });
  }

  // Left click: immediately retry with the same model.
  function handleMouseDown(event: React.MouseEvent<HTMLButtonElement>) {
    if (pendingRetry) return;

    // 0 = primary/left button
    if (event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      runRetry();
    }
  }

  // Right click: show the retry menu (model picker).
  function handleContextMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (pendingRetry) return;

    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  return (
    <Menu.Root
      open={open}
      onOpenChange={function onChangeOpen(nextOpen, eventDetails) {
        // Prevent BaseUI Menu from opening on left-click; we control open state manually.
        if (eventDetails.reason === "trigger-press") {
          eventDetails.cancel();
          return;
        }

        setOpen(nextOpen);
      }}
    >
      <Menu.Trigger
        title="Retry Message"
        data-slot="message-retry-trigger"
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
          <Menu.Popup
            className={cn(
              "flex w-[min(28rem,calc(100vw-1rem))] origin-(--transform-origin) flex-col rounded-md border border-border bg-card p-0 text-card-foreground shadow-lg ring-1 ring-foreground/10",
              "transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            )}
          >
            <MenuArrow className="fill-card" />

            <div className="flex items-center justify-between gap-3 border-b border-border px-3 pt-2 pb-1.5">
              <div className="min-w-0 text-xs font-medium text-foreground">Retry with model</div>

              <button
                type="button"
                onClick={() => runRetry()}
                disabled={pendingRetry}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-7 cursor-pointer gap-1.5 px-2 text-xs",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <RefreshCcwIcon className="size-3.5" />
                Retry same
              </button>
            </div>

            <div className="border-b border-border px-2 py-1.5">
              <label
                htmlFor={`retry-model-search-${userMessageId}`}
                className="flex h-8 items-center gap-2 rounded-md border border-input bg-input/30 px-2"
              >
                <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
                <input
                  id={`retry-model-search-${userMessageId}`}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search models..."
                  className="w-full border-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>

            <div className="flex h-[min(24rem,calc(100vh-12rem))] min-h-[16rem]">
              <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border px-1.5 py-2">
                <PickerSectionButton
                  active={selectedSection === "all"}
                  onClick={() => setSelectedSection("all")}
                  label="All models"
                >
                  <LayersIcon className="size-4" />
                </PickerSectionButton>

                <PickerSectionButton
                  active={selectedSection === "favorites"}
                  onClick={() => setSelectedSection("favorites")}
                  label="Favorite models"
                >
                  <StarIcon className="size-4" />
                </PickerSectionButton>

                {PROVIDER_ORDER.map((provider) => (
                  <PickerSectionButton
                    key={provider}
                    active={selectedSection === provider}
                    onClick={() => setSelectedSection(provider)}
                    label={prettifyProviderName(provider)}
                  >
                    <Icons.provider provider={provider} className="size-4" />
                  </PickerSectionButton>
                ))}
              </div>

              <div
                className="custom-scroll flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto px-1.5 py-2"
                style={{ scrollbarGutter: "stable both-edges" }}
              >
                {groups.length === 0 ? (
                  <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {emptyMessage}
                  </div>
                ) : (
                  groups.map((group) => (
                    <div key={group.key} className="flex flex-col gap-1">
                      <div className="px-2 py-1 text-xs text-muted-foreground">{group.title}</div>

                      {group.models.map((model) => (
                        <RetryModelItem
                          key={model.id}
                          model={model}
                          selected={model.id === currentModelId}
                          disabled={pendingRetry}
                          onSelectModel={handleSelectModel}
                          onSelectEffort={(effort) => {
                            runRetry({
                              modelId: model.id,
                              modelParams: { effort },
                            });
                          }}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

type PickerSectionButtonProps = {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
};

function PickerSectionButton({ active, onClick, label, children }: PickerSectionButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      data-active={active}
      onClick={onClick}
      className={cn(
        "flex size-8 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors",
        "hover:bg-primary/10 hover:text-foreground",
        "data-[active=true]:border-primary/30 data-[active=true]:bg-primary/12 data-[active=true]:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

type RetryModelItemProps = {
  model: RetryModelEntry;
  selected: boolean;
  disabled: boolean;
  onSelectModel: (model: RetryModelEntry) => void;
  onSelectEffort: (effort: ReasoningEffort) => void;
};

function RetryModelItem({
  model,
  selected,
  disabled,
  onSelectModel,
  onSelectEffort,
}: RetryModelItemProps) {
  const effortOptions = React.useMemo(
    () => getValidReasoningEffortOptions(model.data),
    [model.data],
  );

  if (model.data.capabilities.reasoning === true && effortOptions.length > 0) {
    return (
      <Menu.SubmenuRoot>
        <Menu.SubmenuTrigger
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "mt-1 w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-xs outline-none first:mt-0",
            "rounded-md border border-transparent",
            selected && "bg-primary/10 text-foreground ring-1 ring-primary/20",
            "data-open:bg-muted/70",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icons.provider provider={model.provider} className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{model.label}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ModelCapability model={model.data} />
          </div>
        </Menu.SubmenuTrigger>

        <Menu.Portal>
          <Menu.Positioner side="right" align="center" className="p-1" sideOffset={8}>
            <Menu.Popup
              className={cn(
                "custom-scroll flex max-h-[min(18rem,calc(100vh-6rem))] w-[min(14rem,calc(100vw-1rem))] origin-(--transform-origin) flex-col gap-1 overflow-y-auto rounded-md border border-border bg-card p-1 text-card-foreground shadow-lg ring-1 ring-foreground/10",
                "transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
              )}
              style={{ scrollbarGutter: "stable both-edges" }}
            >
              <MenuArrow className="fill-card" />

              {effortOptions.map(({ effort, label, icon: Icon }) => (
                <Menu.Item
                  key={`retry-effort-${model.id}-${effort}`}
                  disabled={disabled}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "w-full cursor-pointer justify-start gap-2.5 px-2.5 py-2 text-xs",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  onClick={() => onSelectEffort(effort)}
                >
                  <Icon className="size-4" />
                  {label}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.SubmenuRoot>
    );
  }

  return (
    <Menu.Item
      disabled={disabled}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "mt-1 w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2 text-xs outline-none first:mt-0",
        "rounded-md border border-transparent",
        selected && "bg-primary/10 text-foreground ring-1 ring-primary/20",
        "data-highlighted:bg-muted/70",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      onClick={() => onSelectModel(model)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icons.provider provider={model.provider} className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{model.label}</span>
      </div>

      <ModelCapability model={model.data} />
    </Menu.Item>
  );
}
