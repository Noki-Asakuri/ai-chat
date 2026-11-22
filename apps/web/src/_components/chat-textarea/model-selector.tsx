import { api } from "@ai-chat/backend/convex/_generated/api";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  createComboboxController,
} from "@ui-sdk/react/combobox";
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { Toggle } from "@ui-sdk/react/toggle";
import { useMutation } from "convex/react";

import { ChevronDownIcon, LayersIcon, SearchIcon, StarIcon } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { useShallow } from "zustand/shallow";

import { useConfigStore } from "@/components/provider/config-provider";

import { ModelCapability } from "@/components/capability-icon";
import { buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";

import {
  AllModelIds,
  SelectableModelIds,
  prettifyProviderName,
  tryGetModelData,
  type Provider,
} from "@/lib/chat/models";
import { useUpdateModelConfig } from "@/lib/chat/use-update-model-config";
import { chatStoreActions } from "@/lib/store/chat-store";
import { cn, tryCatch } from "@/lib/utils";

import {
  PROVIDER_ORDER,
  compareModelLabelsNewestFirst,
  createEmptyProviderModels,
} from "./model-selector-utils";

type ModelSelectorProps = {
  value: string;
  onChange?: (id: string) => void;
  triggerId?: string;
  className?: string;
  disabled?: boolean;
  textOnly?: boolean;
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

// Closing by tabbing or clicking elsewhere already put focus where the person wanted it.
const RESTORE_FOCUS_REASONS = new Set(["item-press", "escape-key", "trigger-press", "close-press"]);

const PICKER_SECTIONS: Array<PickerSectionKey> = ["all", "favorites", ...PROVIDER_ORDER];

function isPickerSection(value: string | null): value is PickerSectionKey {
  return PICKER_SECTIONS.some((section) => section === value);
}

function getSectionLabel(section: PickerSectionKey): string {
  if (section === "all") return "All models";
  if (section === "favorites") return "Favorites";
  return prettifyProviderName(section);
}

function getModelLabel(modelId: string): string {
  const data = tryGetModelData(modelId);
  return data ? (data.display.unique ?? data.display.name) : "Unknown model";
}

function isFavoriteShortcut(event: React.KeyboardEvent<HTMLInputElement>): boolean {
  return (
    event.key.toLowerCase() === "f" && event.shiftKey && (event.metaKey || event.ctrlKey) && !event.altKey
  );
}

// The search box sits inside the popup, so a forward Tab from it lands on the section rail
// in the same popup; the combobox still reports that as focus leaving and would close.
function focusStaysInPopup(content: HTMLElement | null, event: Event | undefined): boolean {
  if (!content || !event) return false;
  if (event instanceof FocusEvent) {
    return event.relatedTarget instanceof Node && content.contains(event.relatedTarget);
  }
  return (
    event instanceof KeyboardEvent &&
    event.key === "Tab" &&
    !event.shiftKey &&
    event.target instanceof Node &&
    content.contains(event.target)
  );
}

function swallow(event: Event) {
  event.preventDefault();
  event.stopPropagation();
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
      <span className="min-w-0 truncate">{modelData.display.unique ?? modelData.display.name}</span>
    </div>
  );
}

function groupProviderModels(models: Array<VisibleModelEntry>): ProviderModels {
  const grouped = createEmptyProviderModels<VisibleModelEntry>();

  for (const model of models) {
    grouped[model.provider].push(model);
  }

  for (const provider of PROVIDER_ORDER) {
    grouped[provider].sort(compareModelLabelsNewestFirst);
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

function ModelSelectorBase({
  value,
  onChange,
  triggerId,
  className,
  disabled,
  textOnly,
}: ModelSelectorProps) {
  const [selectedSection, setSelectedSection] = useState<PickerSectionKey>("all");
  const [isSavingFavorites, setIsSavingFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const closeReason = useRef<string | null>(null);
  const [highlightedModelId, setHighlightedModelId] = useState<string | null>(null);
  const [combobox] = useState(() => createComboboxController());

  const updateUserModelPreferences = useMutation(api.functions.users.updateUserModelPreferences);

  const { hiddenModels, favoriteModels, setFavoriteModels, storeModel, storeDefaultModel, setConfig } =
    useConfigStore(
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
  const knownModelIdSet = useMemo(() => new Set<string>(AllModelIds), []);

  const selectableModels = useMemo(() => {
    const next: Array<VisibleModelEntry> = [];

    for (const modelId of SelectableModelIds) {
      const data = tryGetModelData(modelId);
      if (
        !data ||
        (textOnly && (data.modalities.output.length !== 1 || data.modalities.output[0] !== "text"))
      )
        continue;

      next.push({
        id: modelId,
        label: data.display.unique ?? data.display.name,
        provider: data.provider,
      });
    }

    next.sort(compareModelLabelsNewestFirst);
    return next;
  }, [textOnly]);

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
    () => sanitizeFavoriteModels(favoriteModels, knownModelIdSet),
    [favoriteModels, knownModelIdSet],
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
    const grouped = createEmptyProviderModels<VisibleModelEntry>();

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
  }, [favoriteProviderModels, providerModels, allViewProviderModelsWithoutFavorites, selectedSection]);

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
    if (onChange) {
      onChange(model);
      return;
    }

    chatStoreActions.retainCompatibleAttachments(model);
    setConfig({ model });
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

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isFavoriteShortcut(event)) return;
    event.preventDefault();

    if (highlightedModelId) void handleToggleFavorite(highlightedModelId);
  }

  const highlightedIsFavorite = highlightedModelId ? favoriteModelsSet.has(highlightedModelId) : false;

  return (
    <Combobox
      controller={combobox}
      value={selectedModel}
      onValueChange={(nextValue) => {
        if (nextValue) handleChange(nextValue);
      }}
      query={searchQuery}
      onQueryChange={setSearchQuery}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "focus-out" && focusStaysInPopup(content, details.event)) {
          details.cancel();
          return;
        }
        if (open) setSearchQuery("");
        else closeReason.current = details.reason;
      }}
      onOpenChangeComplete={(open) => {
        if (open) {
          // A touch screen reader opening the list moves focus to the selected option; keep it there.
          if (!content?.contains(document.activeElement)) combobox.focus();
          // The first scroll-into-view ran while the zoom-in animation shrank the popup, landing short.
          content
            ?.querySelector("[data-slot=combobox-item][data-highlighted]")
            ?.scrollIntoView({ block: "nearest" });
          return;
        }
        // Someone else may already have moved focus, like the Ctrl/⌘+M shortcut returning to the composer.
        const focused = document.activeElement;
        const focusIsLost = !focused || focused === document.body || content?.contains(focused);
        if (focusIsLost && closeReason.current && RESTORE_FOCUS_REASONS.has(closeReason.current)) {
          trigger?.focus();
        }
      }}
      onHighlight={(modelId, details) => {
        // The pointer leaving the list clears the highlight; keep it so the footer favorite button stays usable.
        if (modelId === null && details.event instanceof MouseEvent) return;
        setHighlightedModelId(modelId);
      }}
      itemToLabel={getModelLabel}
      autoHighlight="always"
      disabled={disabled}
    >
      <ComboboxTrigger
        ref={setTrigger}
        id={triggerId}
        aria-label="Select model"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "surface-edge h-9 min-w-0 cursor-pointer gap-2 border border-border bg-background/40 px-2.5 py-1.5 hover:bg-primary/12! focus-visible:ring-2 focus-visible:ring-ring/30",
          "flex items-center justify-between rounded-md",
          className,
        )}
      >
        {renderTriggerValue(selectedModel)}
        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </ComboboxTrigger>

      <ComboboxContent
        // Kept mounted so an agent can see the models while the picker is closed.
        keepMounted
        ref={setContent}
        // The combobox only watches its input, so focus leaving from the rail or list must close it here.
        // A null target is a press on the popup's own padding, and the trigger toggles it itself.
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && next !== trigger && !content?.contains(next)) combobox.close();
        }}
        anchor={trigger}
        sideOffset={8}
        collisionPadding={8}
        className={cn(
          "z-50 m-0 flex w-[min(28rem,calc(100vw-1rem))] flex-col overflow-hidden p-0",
          "rounded-lg border border-border bg-card text-card-foreground shadow-md ring-1 ring-foreground/8",
          "origin-(--transform-origin) duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        )}
      >
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background/70 px-2.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <ComboboxInput
              aria-label="Search models"
              placeholder="Search models..."
              autoComplete="off"
              spellCheck={false}
              onKeyDown={handleSearchKeyDown}
              className="h-full min-w-0 flex-1 bg-transparent text-xs outline-hidden placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex h-[min(27rem,calc(100vh-11rem))] min-h-[18rem]">
          <SegmentedControl
            aria-label="Model sections"
            orientation="vertical"
            value={selectedSection}
            onValueChange={(section, details) => {
              if (!isPickerSection(section)) return;
              setSelectedSection(section);
              if (details.source !== "keyboard") combobox.focus();
            }}
            className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/15 px-1.5 py-2.5"
          >
            {PICKER_SECTIONS.map((section) => (
              <SegmentedControlItem
                key={section}
                value={section}
                title={getSectionLabel(section)}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none",
                  "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                  "ring-inset data-checked:bg-primary/12 data-checked:text-primary data-checked:ring-1 data-checked:ring-primary/25",
                )}
              >
                <SectionIcon section={section} />
                <span className="sr-only">{getSectionLabel(section)}</span>
              </SegmentedControlItem>
            ))}
          </SegmentedControl>

          <ComboboxList
            aria-label="Models"
            tabIndex={-1}
            className="h-full min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable_both-edges] overflow-y-auto px-2 py-2.5"
          >
            <ComboboxEmpty className="px-2 py-6 text-center text-xs text-muted-foreground not-data-empty:hidden">
              {emptyMessage}
            </ComboboxEmpty>

            {groups.map((group) => (
              <ComboboxGroup key={group.key} className="overflow-hidden text-foreground not-first:mt-2">
                <ComboboxGroupLabel className="text-2xs px-2 py-1.5 font-medium text-muted-foreground">
                  {group.title}
                </ComboboxGroupLabel>
                {group.models.map((model) => (
                  <ModelItem
                    key={model.id}
                    modelId={model.id}
                    favorite={favoriteModelsSet.has(model.id)}
                    pendingFavorite={isSavingFavorites}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </ComboboxGroup>
            ))}
          </ComboboxList>
        </div>

        <div className="text-2xs flex items-center justify-end gap-1.5 border-t border-border px-3 py-2 text-muted-foreground">
          <Toggle
            pressed={highlightedIsFavorite}
            onPressedChange={() => {
              if (highlightedModelId) void handleToggleFavorite(highlightedModelId);
            }}
            disabled={!highlightedModelId || isSavingFavorites}
            aria-label={
              highlightedModelId ? `Favorite ${getModelLabel(highlightedModelId)}` : "Favorite model"
            }
            className={cn(
              "mr-auto flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors outline-none",
              "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
              "data-pressed:text-amber-400 data-disabled:cursor-not-allowed data-disabled:opacity-50",
            )}
          >
            <StarIcon
              aria-hidden="true"
              className={cn("size-3.5 shrink-0", highlightedIsFavorite && "fill-amber-400")}
            />
            <span className="truncate">Favorite</span>
          </Toggle>
          <Kbd>Ctrl/⌘</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>F</Kbd>
        </div>
      </ComboboxContent>
    </Combobox>
  );
}

function SectionIcon({ section }: { section: PickerSectionKey }) {
  if (section === "all") return <LayersIcon aria-hidden="true" className="size-4" />;
  if (section === "favorites") return <StarIcon aria-hidden="true" className="size-4" />;
  return <Icons.provider provider={section} aria-hidden="true" className="size-4" />;
}

export function ChatModelSelector() {
  const updateModelConfig = useUpdateModelConfig();
  const storeModel = useConfigStore((state) => state.model);

  // Send only the model: the effort is resolved for it (kept if supported, else its default),
  // here and on the server, from the latest saved effort.
  function handleChange(model: string) {
    chatStoreActions.retainCompatibleAttachments(model);
    updateModelConfig({ model });
  }

  return (
    <ModelSelectorBase
      value={storeModel}
      onChange={handleChange}
      triggerId="button-chat-model-selector-trigger"
      className="min-w-15 shrink sm:shrink-0"
    />
  );
}

export function ModelSelector(props: ModelSelectorProps) {
  return <ModelSelectorBase {...props} />;
}

function ModelItem({
  modelId,
  favorite,
  pendingFavorite,
  onToggleFavorite,
}: {
  modelId: string;
  favorite: boolean;
  pendingFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const descriptionId = useId();
  const data = tryGetModelData(modelId);
  if (!data) return null;

  const displayName = data.display.unique ?? data.display.name;

  // Native listeners: the option selects from its own DOM listener, which a React
  // synthetic stopPropagation (dispatched from the root) can't stop.
  function favoriteStarRef(element: HTMLSpanElement | null) {
    if (!element) return undefined;
    const toggle = (event: Event) => {
      swallow(event);
      if (!pendingFavorite) onToggleFavorite(modelId);
    };
    element.addEventListener("pointerdown", swallow);
    element.addEventListener("mousedown", swallow);
    element.addEventListener("click", toggle);
    return () => {
      element.removeEventListener("pointerdown", swallow);
      element.removeEventListener("mousedown", swallow);
      element.removeEventListener("click", toggle);
    };
  }

  return (
    <ComboboxItem
      value={modelId}
      label={displayName}
      aria-label={displayName}
      aria-describedby={`${descriptionId}-capabilities ${descriptionId}-favorite`}
      keywords={[modelId, data.provider, prettifyProviderName(data.provider)]}
      title={displayName}
      className={cn(
        "mt-0.5 flex w-full cursor-pointer items-center justify-between gap-3 px-2.5 py-2.5 outline-none select-none first:mt-0",
        "rounded-md border border-transparent",
        "data-highlighted:bg-muted/70 data-highlighted:text-foreground",
        "data-selected:bg-primary/10 data-selected:text-foreground data-selected:ring-1 data-selected:ring-primary/15",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Icons.provider provider={data.provider} aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 truncate text-xs font-medium">{displayName}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* Hidden from the option's own text so screen readers and agents name it by the model alone;
            aria-describedby still reads both. */}
        <div id={`${descriptionId}-capabilities`} aria-hidden="true">
          <ModelCapability model={data} tooltip={false} />
        </div>
        <span id={`${descriptionId}-favorite`} aria-hidden="true" className="sr-only">
          {favorite ? "Favorite." : "Not a favorite."}
        </span>

        <span
          ref={favoriteStarRef}
          aria-hidden="true"
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          data-favorite={favorite || undefined}
          data-pending={pendingFavorite || undefined}
          className={cn(
            "flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "data-pending:cursor-not-allowed data-pending:opacity-50",
            "data-favorite:text-amber-400",
          )}
        >
          <StarIcon className={cn("size-3.5", favorite && "fill-amber-400")} />
        </span>
      </div>
    </ComboboxItem>
  );
}
