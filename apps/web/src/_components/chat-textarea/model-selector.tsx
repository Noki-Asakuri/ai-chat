import { api } from "@ai-chat/backend/convex/_generated/api";

import { useParams } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { ChevronDownIcon, LayersIcon, StarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";

import { ModelCapability } from "@/components/capability-icon";
import { buttonVariants } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Icons } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  SelectableModelIds,
  prettifyProviderName,
  tryGetModelData,
  type Provider,
} from "@/lib/chat/models";
import { useSyncThreadModelConfig } from "@/lib/chat/server-function/sync-thread-model-config";
import { cn, tryCatch } from "@/lib/utils";

type ModelSelectorProps = {
  value: string;
  onChange?: (id: string) => void;
  triggerId?: string;
  className?: string;
};

type PickerSectionKey = "all" | "favorites" | Provider;

type VisibleModelEntry = {
  id: string;
  label: string;
  provider: Provider;
};

type ProviderModels = Record<Provider, Array<VisibleModelEntry>>;

type ModelGroup = {
  key: string;
  title: string;
  models: Array<VisibleModelEntry>;
};

export const PROVIDER_ORDER: Array<Provider> = ["google", "openai", "deepseek", "kimi", "zai"];

export function createEmptyProviderModels<T extends Record<Provider, unknown[]>>(): T {
  return { google: [], openai: [], deepseek: [], kimi: [], zai: [] } as unknown as T;
}

function sortEntriesByLabel(a: VisibleModelEntry, b: VisibleModelEntry): number {
  return a.label.localeCompare(b.label);
}

export function groupProviderModels(models: Array<VisibleModelEntry>): ProviderModels {
  const grouped = createEmptyProviderModels<ProviderModels>();

  for (const model of models) {
    grouped[model.provider].push(model);
  }

  for (const provider of PROVIDER_ORDER) {
    grouped[provider].sort(sortEntriesByLabel);
  }

  return grouped;
}

export function appendProviderGroups(
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

function sanitizeFavoriteModels(
  favoriteModels: string[],
  selectableModelIdSet: ReadonlySet<string>,
): string[] {
  const sanitized: string[] = [];
  const seen = new Set<string>();

  for (const modelId of favoriteModels) {
    if (!selectableModelIdSet.has(modelId)) continue;
    if (seen.has(modelId)) continue;

    seen.add(modelId);
    sanitized.push(modelId);
  }

  return sanitized;
}

function toggleFavoriteModels(favoriteModels: string[], modelId: string): string[] {
  if (favoriteModels.includes(modelId)) {
    return favoriteModels.filter((id) => id !== modelId);
  }

  return [modelId, ...favoriteModels];
}

function ModelSelectorBase({ value, onChange, triggerId, className }: ModelSelectorProps) {
  const [selectedSection, setSelectedSection] = useState<PickerSectionKey>("all");
  const [isSavingFavorites, setIsSavingFavorites] = useState(false);

  const updateUserModelPreferences = useMutation(api.functions.users.updateUserModelPreferences);

  const {
    hiddenModels,
    favoriteModels,
    setFavoriteModels,
    storeModel,
    storeDefaultModel,
    setConfig,
  } = useConfigStore(
    useShallow((state) => ({
      hiddenModels: state.hiddenModels,
      favoriteModels: state.favoriteModels,
      setFavoriteModels: state.setFavoriteModels,
      storeModel: state.model,
      storeDefaultModel: state.defaultModel,
      setConfig: state.setConfig,
    })),
  );

  const selectedModel =
    (value && value.length > 0 ? value : null) ??
    (storeModel && storeModel.length > 0 ? storeModel : null) ??
    storeDefaultModel;

  const selectableModelIdSet = useMemo(() => new Set<string>(SelectableModelIds), []);

  const selectableModels = useMemo(() => {
    const next: Array<VisibleModelEntry> = [];

    for (const modelId of SelectableModelIds) {
      const data = tryGetModelData(modelId);
      if (!data) continue;

      next.push({
        id: modelId,
        label: data.display.unique ?? data.display.name,
        provider: data.provider,
      });
    }

    next.sort(sortEntriesByLabel);
    return next;
  }, []);

  const allViewModels = useMemo(() => {
    const hiddenSet = new Set<string>(hiddenModels);
    const next: Array<VisibleModelEntry> = [];

    for (const model of selectableModels) {
      if (hiddenSet.has(model.id)) continue;
      next.push(model);
    }

    return next;
  }, [hiddenModels, selectableModels]);

  const allViewModelMap = useMemo(() => {
    const map = new Map<string, VisibleModelEntry>();

    for (const entry of allViewModels) {
      map.set(entry.id, entry);
    }

    return map;
  }, [allViewModels]);

  const sanitizedFavoriteModels = useMemo(
    () => sanitizeFavoriteModels(favoriteModels, selectableModelIdSet),
    [favoriteModels, selectableModelIdSet],
  );

  const favoriteModelsSet = useMemo(
    () => new Set<string>(sanitizedFavoriteModels),
    [sanitizedFavoriteModels],
  );

  const favoriteVisibleModels = useMemo(() => {
    const next: Array<VisibleModelEntry> = [];

    for (const modelId of sanitizedFavoriteModels) {
      const model = allViewModelMap.get(modelId);
      if (!model) continue;
      next.push(model);
    }

    return next;
  }, [sanitizedFavoriteModels, allViewModelMap]);

  const favoriteProviderModels = useMemo(() => {
    return groupProviderModels(favoriteVisibleModels);
  }, [favoriteVisibleModels]);

  const providerModels = useMemo(() => {
    return groupProviderModels(selectableModels);
  }, [selectableModels]);

  const allViewProviderModels = useMemo(() => {
    return groupProviderModels(allViewModels);
  }, [allViewModels]);

  const allViewProviderModelsWithoutFavorites = useMemo(() => {
    const grouped = createEmptyProviderModels<ProviderModels>();

    for (const provider of PROVIDER_ORDER) {
      const models = allViewProviderModels[provider];

      for (const model of models) {
        if (favoriteModelsSet.has(model.id)) continue;
        grouped[provider].push(model);
      }
    }

    return grouped;
  }, [allViewProviderModels, favoriteModelsSet]);

  const groups = useMemo(() => {
    const next: Array<ModelGroup> = [];

    if (selectedSection === "favorites") {
      appendProviderGroups(next, favoriteProviderModels, { keyPrefix: "favorites" });

      return next;
    }

    if (selectedSection === "all") {
      appendProviderGroups(next, favoriteProviderModels, {
        keyPrefix: "favorites",
        titleSuffix: "Favorites",
      });
      appendProviderGroups(next, allViewProviderModelsWithoutFavorites);

      return next;
    }

    const selectedProviderModels = providerModels[selectedSection];
    if (selectedProviderModels.length > 0) {
      next.push({
        key: selectedSection,
        title: prettifyProviderName(selectedSection),
        models: selectedProviderModels,
      });
    }

    return next;
  }, [
    favoriteProviderModels,
    providerModels,
    allViewProviderModelsWithoutFavorites,
    selectedSection,
  ]);

  const emptyMessage = useMemo(() => {
    if (selectedSection === "all" && allViewModels.length === 0) {
      return "No models available. Enable models in Settings -> Models.";
    }

    if (selectedSection === "favorites" && favoriteVisibleModels.length === 0) {
      return "No favorite models yet. Star a model to pin it here.";
    }

    return "No models match your search.";
  }, [allViewModels.length, favoriteVisibleModels.length, selectedSection]);

  function handleChange(model: string) {
    if (onChange) onChange(model);
    else setConfig({ model });
  }

  async function handleToggleFavorite(modelId: string) {
    if (!selectableModelIdSet.has(modelId)) return;
    if (isSavingFavorites) return;

    const previous = sanitizedFavoriteModels;
    const next = toggleFavoriteModels(previous, modelId);

    setFavoriteModels(next);
    setIsSavingFavorites(true);

    const [, error] = await tryCatch(updateUserModelPreferences({ data: { favorite: next } }));

    setIsSavingFavorites(false);

    if (error) {
      setFavoriteModels(previous);
      toast.error("Failed to save favorite models", { description: error.message });
    }
  }

  function renderTriggerValue(nextValue: string) {
    const modelData = tryGetModelData(nextValue);

    if (!modelData) {
      return (
        <div className="flex min-w-0 items-center gap-2">
          <Icons.unknown className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Unknown model</span>
        </div>
      );
    }

    return (
      <div className="flex min-w-0 items-center gap-2">
        <Icons.provider provider={modelData.provider} className="size-4 shrink-0" />
        <span className="min-w-0 truncate">
          {modelData.display.unique ?? modelData.display.name}
        </span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        id={triggerId}
        aria-label="Select model"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 min-w-0 cursor-pointer gap-2 border border-border bg-background/40 px-2.5 py-1.5 shadow-xs hover:bg-primary/12! focus-visible:ring-2 focus-visible:ring-ring/30",
          "flex items-center justify-between rounded-md",
          className,
        )}
      >
        {renderTriggerValue(selectedModel)}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent
        sideOffset={8}
        includeArrow={false}
        className={cn(
          "w-[min(28rem,calc(100vw-1rem))] p-0",
          "rounded-md border border-border bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10",
        )}
      >
        <Command loop className="rounded-md bg-transparent text-popover-foreground">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 pt-2 pb-1.5">
            <div className="min-w-0 text-xs font-medium text-foreground">Models</div>
            <div className="shrink-0 text-[11px] text-muted-foreground">Type to search</div>
          </div>

          <CommandInput placeholder="Search models..." className="h-9" />

          <div className="flex h-[min(26rem,calc(100vh-12rem))] min-h-[18rem]">
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
                label="Favorites"
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

            <CommandList
              className="custom-scroll h-full max-h-none min-h-0 min-w-0 flex-1 px-1.5 py-2"
              style={{ scrollbarGutter: "stable both-edges" }}
            >
              <CommandEmpty className="px-2 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </CommandEmpty>

              {groups.map((group) => (
                <CommandGroup key={group.key} heading={group.title}>
                  {group.models.map((model) => (
                    <ModelItem
                      key={model.id}
                      modelId={model.id}
                      selected={model.id === selectedModel}
                      favorite={favoriteModelsSet.has(model.id)}
                      pendingFavorite={isSavingFavorites}
                      onChange={handleChange}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PickerSectionButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
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

export function ChatModelSelector() {
  const params = useParams({ from: "/_chat/threads/$threadId", shouldThrow: false });
  const isWelcomeRoute = !params?.threadId;
  const { syncThreadModelConfig } = useSyncThreadModelConfig();

  const storeModel = useConfigStore((state) => state.model);
  const setConfig = useConfigStore((state) => state.setConfig);

  function handleChange(model: string) {
    if (isWelcomeRoute) {
      setConfig({ model, defaultModel: model });
    } else {
      setConfig({ model });
    }

    void syncThreadModelConfig({ model });
  }

  return (
    <ModelSelectorBase
      value={storeModel}
      onChange={handleChange}
      triggerId="button-chat-model-selector-trigger"
    />
  );
}

export function ModelSelector(props: ModelSelectorProps) {
  return <ModelSelectorBase {...props} />;
}

function ModelItem({
  selected,
  modelId,
  favorite,
  pendingFavorite,
  onChange,
  onToggleFavorite,
}: {
  selected: boolean;
  modelId: string;
  favorite: boolean;
  pendingFavorite: boolean;
  onChange?: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const data = tryGetModelData(modelId);
  if (!data) return null;

  const displayName = data.display.unique ?? data.display.name;

  function handleSelect() {
    onChange?.(modelId);
  }

  function handleFavoriteMouseDown(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleFavoriteClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onToggleFavorite(modelId);
  }

  return (
    <CommandItem
      value={modelId}
      keywords={[displayName, data.provider, prettifyProviderName(data.provider)]}
      onSelect={handleSelect}
      data-model-selected={selected}
      title={displayName}
      className={cn(
        "mt-1 w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2 outline-none select-none first:mt-0",
        "rounded-md border border-transparent",
        "data-selected:bg-muted/70 data-selected:text-foreground",
        "data-[model-selected=true]:bg-primary/10 data-[model-selected=true]:text-foreground data-[model-selected=true]:ring-1 data-[model-selected=true]:ring-primary/20",
        "[&>svg:last-child]:hidden",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icons.provider provider={data.provider} className="size-4 shrink-0" />
        <span className="min-w-0 truncate text-xs">{displayName}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ModelCapability model={data} />

        <button
          type="button"
          onMouseDown={handleFavoriteMouseDown}
          onClick={handleFavoriteClick}
          disabled={pendingFavorite}
          aria-label={favorite ? `Remove ${displayName} from favorites` : `Favorite ${displayName}`}
          className={cn(
            "flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-primary/12 hover:text-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            favorite && "text-amber-400",
          )}
        >
          <StarIcon className={cn("size-3.5", favorite && "fill-amber-400")} />
        </button>
      </div>
    </CommandItem>
  );
}
