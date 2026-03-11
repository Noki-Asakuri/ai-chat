import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ChevronDownIcon,
  BrainIcon,
  EyeIcon,
  GlobeIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  StarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import type {
  AllModelIds as ModelId,
  ModelDeprecation,
  ModelIdKey,
  Provider,
} from "@/lib/chat/models";
import {
  AllModelIds,
  getModelData,
  prettifyProviderName,
  SelectableModelIds,
  type ModelData,
} from "@/lib/chat/models";
import { cn, tryCatch } from "@/lib/utils";

type ModelEntry = {
  modelId: ModelId;
  provider: Provider;
  providerName: string;
  displayName: string;
  deprecation: ModelDeprecation | null;
  capabilitySet: ReadonlySet<ModelCapabilityKey>;
  searchText: string;
};

type ModelsCustomization = {
  hidden: string[];
  favorite: string[];
};

type PersistableModelSet = "hidden" | "favorite";

type ModelCapabilityKey = "reasoning" | "webSearch" | "vision" | "generateImage";

const PROVIDER_ORDER_INDEX: Record<Provider, number> = {
  google: 0,
  openai: 1,
  deepseek: 2,
};

const STATUS_BADGE_STYLES: Record<"visible" | "hidden" | "favorite" | "deprecated", string> = {
  visible: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  hidden: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  favorite: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  deprecated: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const SAVE_DEBOUNCE_MS = 1000;
const MODELS_GRID_OVERSCAN = 3;
const MODELS_GRID_ESTIMATED_ROW_HEIGHT_PX = 220;
const MODELS_GRID_VIRTUALIZATION_MIN_ROWS = 80;

const CAPABILITY_FILTER_OPTIONS: Array<{
  value: ModelCapabilityKey;
  label: string;
  Icon: typeof BrainIcon;
}> = [
  { value: "reasoning", label: "Reasoning", Icon: BrainIcon },
  { value: "webSearch", label: "Web search", Icon: GlobeIcon },
  { value: "vision", label: "Vision", Icon: EyeIcon },
  { value: "generateImage", label: "Image generation", Icon: ImagePlusIcon },
];

const SELECTABLE_MODEL_ID_SET: ReadonlySet<string> = new Set<string>(SelectableModelIds);

const MODEL_ENTRIES: Array<ModelEntry> = AllModelIds.slice()
  .sort((a, b) => a.localeCompare(b))
  .map((modelId) => {
    const data = getModelData(modelId);

    const displayName = data.display.unique ?? data.display.name;
    const providerName = prettifyProviderName(data.provider);
    const deprecation = data.deprecation ?? null;
    const capabilitySet = getCapabilitySet(data);

    const searchText =
      `${displayName} ${data.provider} ${providerName} ${deprecation?.message ?? ""}`.toLowerCase();

    return {
      modelId,
      provider: data.provider,
      providerName,
      displayName,
      deprecation,
      capabilitySet,
      searchText,
    };
  });

function getCapabilitySet(data: ModelData): ReadonlySet<ModelCapabilityKey> {
  const capabilitySet = new Set<ModelCapabilityKey>();

  if (data.capabilities.reasoning === true || data.capabilities.reasoning === "always") {
    capabilitySet.add("reasoning");
  }

  if (data.capabilities.webSearch) {
    capabilitySet.add("webSearch");
  }

  if (data.capabilities.vision) {
    capabilitySet.add("vision");
  }

  if (data.capabilities.generateImage) {
    capabilitySet.add("generateImage");
  }

  return capabilitySet;
}

function isModelIdKey(value: string): value is ModelIdKey {
  const slashIndex = value.indexOf("/");
  if (slashIndex <= 0) return false;

  const provider = value.slice(0, slashIndex);
  return provider === "google" || provider === "openai" || provider === "deepseek";
}

function sanitizeModelIds(
  modelIds: string[],
  selectableModelIdSet: ReadonlySet<string>,
): Set<string> {
  const sanitized = new Set<string>();

  for (const modelId of modelIds) {
    if (!isModelIdKey(modelId)) continue;
    if (!selectableModelIdSet.has(modelId)) continue;
    sanitized.add(modelId);
  }

  return sanitized;
}

function toModelIdsPayload(
  modelSet: ReadonlySet<string>,
  selectableModelIdSet: ReadonlySet<string>,
): string[] {
  const next: string[] = [];

  for (const modelId of modelSet) {
    if (!isModelIdKey(modelId)) continue;
    if (!selectableModelIdSet.has(modelId)) continue;
    next.push(modelId);
  }

  return next;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;

  for (const value of a) {
    if (!b.has(value)) return false;
  }

  return true;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function compareByName(a: ModelEntry, b: ModelEntry): number {
  return a.displayName.localeCompare(b.displayName);
}

function compareByProviderThenName(a: ModelEntry, b: ModelEntry): number {
  const providerDiff = PROVIDER_ORDER_INDEX[a.provider] - PROVIDER_ORDER_INDEX[b.provider];
  if (providerDiff !== 0) return providerDiff;

  return compareByName(a, b);
}

function getModelsScrollElement(listElement: HTMLDivElement | null): HTMLElement | null {
  if (!listElement) return null;

  const scrollElement = listElement.closest(".custom-scroll");
  if (scrollElement instanceof HTMLElement) return scrollElement;

  return null;
}

export type ModelsEditorProps = {
  disabled: boolean;
  initialHiddenModels: string[];
  initialFavoriteModels: string[];
  onSaveCustomization: (customization: Partial<ModelsCustomization>) => Promise<void>;
};

export function ModelsEditor(props: ModelsEditorProps) {
  const { disabled, initialHiddenModels, initialFavoriteModels, onSaveCustomization } = props;

  const [query, setQuery] = useState("");
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [capabilityFilter, setCapabilityFilter] = useState<Set<ModelCapabilityKey>>(
    () => new Set<ModelCapabilityKey>(),
  );

  const [hiddenSet, setHiddenSet] = useState<Set<string>>(() =>
    sanitizeModelIds(initialHiddenModels, SELECTABLE_MODEL_ID_SET),
  );
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(() =>
    sanitizeModelIds(initialFavoriteModels, SELECTABLE_MODEL_ID_SET),
  );

  const [savingHidden, setSavingHidden] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [hiddenSaveError, setHiddenSaveError] = useState(false);
  const [favoriteSaveError, setFavoriteSaveError] = useState(false);

  const lastSyncedHiddenRef = useRef<Set<string>>(
    sanitizeModelIds(initialHiddenModels, SELECTABLE_MODEL_ID_SET),
  );
  const lastSyncedFavoriteRef = useRef<Set<string>>(
    sanitizeModelIds(initialFavoriteModels, SELECTABLE_MODEL_ID_SET),
  );

  const queuedHiddenSetRef = useRef<Set<string> | null>(null);
  const queuedFavoriteSetRef = useRef<Set<string> | null>(null);
  const hiddenDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favoriteDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef<{ hidden: boolean; favorite: boolean }>({
    hidden: false,
    favorite: false,
  });

  useEffect(() => {
    return function cleanupMountedRef() {
      if (hiddenDebounceTimerRef.current) {
        clearTimeout(hiddenDebounceTimerRef.current);
        hiddenDebounceTimerRef.current = null;
      }

      if (favoriteDebounceTimerRef.current) {
        clearTimeout(favoriteDebounceTimerRef.current);
        favoriteDebounceTimerRef.current = null;
      }

      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nextHidden = sanitizeModelIds(initialHiddenModels, SELECTABLE_MODEL_ID_SET);
    const nextFavorite = sanitizeModelIds(initialFavoriteModels, SELECTABLE_MODEL_ID_SET);

    lastSyncedHiddenRef.current = nextHidden;
    lastSyncedFavoriteRef.current = nextFavorite;

    if (!inFlightRef.current.hidden) {
      setHiddenSet(nextHidden);
    }

    if (!inFlightRef.current.favorite) {
      setFavoriteSet(nextFavorite);
    }
  }, [initialFavoriteModels, initialHiddenModels]);

  const persistModelSet = useCallback(
    async function persistModelSet(kind: PersistableModelSet, nextSet: Set<string>) {
      const payload = toModelIdsPayload(nextSet, SELECTABLE_MODEL_ID_SET);
      if (kind === "hidden") {
        const [, error] = await tryCatch(onSaveCustomization({ hidden: payload }));
        if (error) throw error;
        return;
      }

      const [, error] = await tryCatch(onSaveCustomization({ favorite: payload }));
      if (error) throw error;
    },
    [onSaveCustomization],
  );

  const flushQueue = useCallback(
    async function flushQueue(kind: PersistableModelSet) {
      if (!mountedRef.current) return;

      if (kind === "hidden") {
        if (inFlightRef.current.hidden) return;

        const queuedSet = queuedHiddenSetRef.current;
        if (!queuedSet) return;

        if (setsEqual(queuedSet, lastSyncedHiddenRef.current)) {
          queuedHiddenSetRef.current = null;
          setSavingHidden(false);
          setHiddenSaveError(false);
          return;
        }

        inFlightRef.current.hidden = true;

        const nextSet = new Set<string>(queuedSet);
        queuedHiddenSetRef.current = null;

        const [, error] = await tryCatch(persistModelSet("hidden", nextSet));

        inFlightRef.current.hidden = false;
        if (!mountedRef.current) return;

        if (error) {
          queuedHiddenSetRef.current = queuedHiddenSetRef.current ?? nextSet;
          setSavingHidden(false);
          setHiddenSaveError(true);
          toast.error("Failed to save hidden models", {
            description: `${toErrorMessage(error)} Changes are kept locally.`,
          });
          return;
        }

        lastSyncedHiddenRef.current = new Set(nextSet);
        toast.success("Model visibility saved", { id: "models-save-success" });

        if (queuedHiddenSetRef.current) {
          await flushQueue("hidden");
          return;
        }

        setHiddenSaveError(false);
        setSavingHidden(false);
        return;
      }

      if (inFlightRef.current.favorite) return;

      const queuedSet = queuedFavoriteSetRef.current;
      if (!queuedSet) return;

      if (setsEqual(queuedSet, lastSyncedFavoriteRef.current)) {
        queuedFavoriteSetRef.current = null;
        setSavingFavorite(false);
        setFavoriteSaveError(false);
        return;
      }

      inFlightRef.current.favorite = true;

      const nextSet = new Set<string>(queuedSet);
      queuedFavoriteSetRef.current = null;

      const [, error] = await tryCatch(persistModelSet("favorite", nextSet));

      inFlightRef.current.favorite = false;
      if (!mountedRef.current) return;

      if (error) {
        queuedFavoriteSetRef.current = queuedFavoriteSetRef.current ?? nextSet;
        setSavingFavorite(false);
        setFavoriteSaveError(true);
        toast.error("Failed to save favorite models", {
          description: `${toErrorMessage(error)} Changes are kept locally.`,
        });
        return;
      }

      lastSyncedFavoriteRef.current = new Set(nextSet);
      toast.success("Favorite models saved", { id: "models-save-success" });

      if (queuedFavoriteSetRef.current) {
        await flushQueue("favorite");
        return;
      }

      setFavoriteSaveError(false);
      setSavingFavorite(false);
    },
    [persistModelSet],
  );

  const scheduleFlush = useCallback(
    function scheduleFlush(kind: PersistableModelSet) {
      if (kind === "hidden") {
        if (hiddenDebounceTimerRef.current) {
          clearTimeout(hiddenDebounceTimerRef.current);
        }

        hiddenDebounceTimerRef.current = setTimeout(() => {
          hiddenDebounceTimerRef.current = null;
          void flushQueue("hidden");
        }, SAVE_DEBOUNCE_MS);

        return;
      }

      if (favoriteDebounceTimerRef.current) {
        clearTimeout(favoriteDebounceTimerRef.current);
      }

      favoriteDebounceTimerRef.current = setTimeout(() => {
        favoriteDebounceTimerRef.current = null;
        void flushQueue("favorite");
      }, SAVE_DEBOUNCE_MS);
    },
    [flushQueue],
  );

  const queuePersist = useCallback(
    function queuePersist(kind: PersistableModelSet, nextSet: Set<string>) {
      if (kind === "hidden") {
        queuedHiddenSetRef.current = new Set(nextSet);
        setHiddenSaveError(false);
        setSavingHidden(true);
      } else {
        queuedFavoriteSetRef.current = new Set(nextSet);
        setFavoriteSaveError(false);
        setSavingFavorite(true);
      }

      scheduleFlush(kind);
    },
    [scheduleFlush],
  );

  const onSetVisible = useCallback(
    function onSetVisible(modelId: string, visible: boolean) {
      if (disabled) return;
      if (!isModelIdKey(modelId)) return;
      if (!SELECTABLE_MODEL_ID_SET.has(modelId)) return;

      setHiddenSet((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(modelId);
        } else {
          next.add(modelId);
        }

        queuePersist("hidden", next);
        return next;
      });
    },
    [disabled, queuePersist],
  );

  const onRetrySave = useCallback(
    function onRetrySave() {
      if (queuedHiddenSetRef.current) {
        setSavingHidden(true);
        void flushQueue("hidden");
      }

      if (queuedFavoriteSetRef.current) {
        setSavingFavorite(true);
        void flushQueue("favorite");
      }
    },
    [flushQueue],
  );

  const onToggleFavorite = useCallback(
    function onToggleFavorite(modelId: string) {
      if (disabled) return;
      if (!isModelIdKey(modelId)) return;
      if (!SELECTABLE_MODEL_ID_SET.has(modelId)) return;

      setFavoriteSet((prev) => {
        const next = new Set(prev);
        if (next.has(modelId)) {
          next.delete(modelId);
        } else {
          next.add(modelId);
        }

        queuePersist("favorite", next);
        return next;
      });
    },
    [disabled, queuePersist],
  );

  const onShowAll = useCallback(
    function onShowAll() {
      if (disabled) return;
      const next = new Set<string>();
      setHiddenSet(next);
      queuePersist("hidden", next);
    },
    [disabled, queuePersist],
  );

  const onSetCapabilityFilter = useCallback(function onSetCapabilityFilter(
    capability: ModelCapabilityKey,
    checked: boolean,
  ) {
    setCapabilityFilter((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(capability);
      } else {
        next.delete(capability);
      }

      return next;
    });
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredModels = useMemo(() => {
    const result: Array<ModelEntry> = [];

    for (const entry of MODEL_ENTRIES) {
      if (normalizedQuery.length > 0 && !entry.searchText.includes(normalizedQuery)) continue;

      if (visibleOnly && (entry.deprecation || hiddenSet.has(entry.modelId))) continue;

      if (favoritesOnly && !favoriteSet.has(entry.modelId)) continue;

      if (capabilityFilter.size > 0) {
        let hasAllCapabilities = true;

        for (const capability of capabilityFilter) {
          if (!entry.capabilitySet.has(capability)) {
            hasAllCapabilities = false;
            break;
          }
        }

        if (!hasAllCapabilities) continue;
      }

      result.push(entry);
    }

    result.sort(compareByProviderThenName);
    return result;
  }, [capabilityFilter, favoriteSet, favoritesOnly, hiddenSet, normalizedQuery, visibleOnly]);

  const counts = useMemo(() => {
    let deprecated = 0;
    let hidden = 0;
    let favorite = 0;

    for (const entry of MODEL_ENTRIES) {
      if (entry.deprecation) {
        deprecated += 1;
        continue;
      }

      if (hiddenSet.has(entry.modelId)) hidden += 1;
      if (favoriteSet.has(entry.modelId)) favorite += 1;
    }

    const selectableCount = SelectableModelIds.length;
    const visible = selectableCount - hidden;

    return {
      selectableCount,
      visible,
      hidden,
      favorite,
      deprecated,
    };
  }, [favoriteSet, hiddenSet]);

  const emptyMessage = useMemo(() => {
    if (favoritesOnly) {
      return "No favorite models match your current filters.";
    }

    return "No models match your filters.";
  }, [favoritesOnly]);

  const saving = savingHidden || savingFavorite;
  const hasSaveError = hiddenSaveError || favoriteSaveError;

  return (
    <Card className="rounded-md">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className={cn(
              "gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_STYLES.visible,
            )}
          >
            <span className="font-semibold tabular-nums">{counts.visible}</span>
            visible
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              "gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_STYLES.hidden,
            )}
          >
            <span className="font-semibold tabular-nums">{counts.hidden}</span>
            hidden
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              "gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_STYLES.favorite,
            )}
          >
            <span className="font-semibold tabular-nums">{counts.favorite}</span>
            favorites
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              "gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_STYLES.deprecated,
            )}
          >
            <span className="font-semibold tabular-nums">{counts.deprecated}</span>
            deprecated
          </Badge>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {saving && (
              <Badge variant="outline" className="gap-1 rounded-sm px-2 py-0.5 text-xs">
                <LoaderCircleIcon className="size-3 animate-spin" />
                Saving...
              </Badge>
            )}

            {hasSaveError && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving}
                onClick={onRetrySave}
              >
                Retry save
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              disabled={disabled || hiddenSet.size === 0}
              onClick={onShowAll}
            >
              Show all models
            </Button>
          </div>
        </div>

        <ModelsFilter
          query={query}
          onQueryChange={setQuery}
          capabilityFilter={capabilityFilter}
          onSetCapabilityFilter={onSetCapabilityFilter}
          visibleOnly={visibleOnly}
          onVisibleOnlyChange={setVisibleOnly}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          disabled={disabled}
        />

        <Separator />

        <ModelsGrid
          models={filteredModels}
          hiddenSet={hiddenSet}
          favoriteSet={favoriteSet}
          onSetVisible={onSetVisible}
          onToggleFavorite={onToggleFavorite}
          disabled={disabled}
          emptyMessage={emptyMessage}
        />
      </CardContent>
    </Card>
  );
}

type ModelsFilterProps = {
  query: string;
  onQueryChange: (value: string) => void;
  capabilityFilter: ReadonlySet<ModelCapabilityKey>;
  onSetCapabilityFilter: (capability: ModelCapabilityKey, checked: boolean) => void;
  visibleOnly: boolean;
  onVisibleOnlyChange: (value: boolean) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  disabled: boolean;
};

function ModelsFilter(props: ModelsFilterProps) {
  const selectedCapabilityCount = props.capabilityFilter.size;
  const capabilityLabel =
    selectedCapabilityCount > 0
      ? `${selectedCapabilityCount} ${selectedCapabilityCount > 1 ? "capabilities" : "capability"} selected`
      : "All capabilities";

  function handleClearCapabilityFilters() {
    for (const capability of props.capabilityFilter) {
      props.onSetCapabilityFilter(capability, false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)_minmax(13rem,16rem)_minmax(13rem,16rem)] lg:items-start">
      <div className="space-y-2 lg:min-w-0">
        <Label htmlFor="model-search">Search models</Label>
        <Input
          id="model-search"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Search by model name or provider..."
          className="bg-input/30 outline-none"
          disabled={props.disabled}
        />
      </div>

      <div className="space-y-2 lg:min-w-64">
        <Label htmlFor="model-capability">Capability</Label>

        <DropdownMenu>
          <DropdownMenuTrigger
            id="model-capability"
            render={
              <Button
                variant="outline"
                className="h-8 w-full justify-between bg-input/30 text-xs font-normal"
                disabled={props.disabled}
                aria-label="Filter by model capability"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <BrainIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{capabilityLabel}</span>
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            }
          />

          <DropdownMenuContent className="bg-card" sideOffset={6}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filter capabilities</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {CAPABILITY_FILTER_OPTIONS.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={props.capabilityFilter.has(option.value)}
                  onCheckedChange={(checked) => {
                    props.onSetCapabilityFilter(option.value, checked === true);
                  }}
                  onSelect={(event) => {
                    event.preventDefault();
                  }}
                >
                  <option.Icon className="size-3.5 text-muted-foreground" />
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>

            {selectedCapabilityCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => {
                      handleClearCapabilityFilters();
                    }}
                    onSelect={(event) => {
                      event.preventDefault();
                      handleClearCapabilityFilters();
                    }}
                  >
                    Clear capability filters
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2 lg:min-w-0">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="visible-only" className="text-sm leading-none font-medium">
            Visible only
          </Label>
          <p className="text-xs text-muted-foreground">Hide hidden and deprecated models.</p>
        </div>

        <div className="flex h-8 items-center">
          <Switch
            id="visible-only"
            checked={props.visibleOnly}
            onCheckedChange={props.onVisibleOnlyChange}
            disabled={props.disabled}
            aria-label="Show visible models only"
          />
        </div>
      </div>

      <div className="space-y-2 lg:min-w-0">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="favorites-only" className="text-sm leading-none font-medium">
            Favorites only
          </Label>
          <p className="text-xs text-muted-foreground">Show only starred models.</p>
        </div>

        <div className="flex h-8 items-center">
          <Switch
            id="favorites-only"
            checked={props.favoritesOnly}
            onCheckedChange={props.onFavoritesOnlyChange}
            disabled={props.disabled}
            aria-label="Show favorite models only"
          />
        </div>
      </div>
    </div>
  );
}

type ModelsGridProps = {
  models: Array<ModelEntry>;
  hiddenSet: ReadonlySet<string>;
  favoriteSet: ReadonlySet<string>;
  onSetVisible: (modelId: string, visible: boolean) => void;
  onToggleFavorite: (modelId: string) => void;
  disabled: boolean;
  emptyMessage: string;
};

function ModelsGrid(props: ModelsGridProps) {
  if (props.models.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
        {props.emptyMessage}
      </div>
    );
  }

  if (props.models.length < MODELS_GRID_VIRTUALIZATION_MIN_ROWS) {
    return <StaticModelsGrid {...props} />;
  }

  return <VirtualizedModelsGrid {...props} />;
}

function StaticModelsGrid(props: ModelsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {props.models.map(function renderModelRow(entry) {
        return (
          <ModelRow
            key={entry.modelId}
            entry={entry}
            visible={!entry.deprecation && !props.hiddenSet.has(entry.modelId)}
            favorite={props.favoriteSet.has(entry.modelId)}
            onSetVisible={props.onSetVisible}
            onToggleFavorite={props.onToggleFavorite}
            disabled={props.disabled}
          />
        );
      })}
    </div>
  );
}

type VirtualizedRow = {
  key: string;
  entry: ModelEntry;
};

function VirtualizedModelsGrid(props: ModelsGridProps) {
  const listElementRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLElement | null>(null);

  const rows = useMemo(() => {
    const nextRows: Array<VirtualizedRow> = [];

    for (const entry of props.models) {
      nextRows.push({
        key: entry.modelId,
        entry,
      });
    }

    return nextRows;
  }, [props.models]);

  const getScrollElement = useCallback(function getScrollElement() {
    const cached = scrollElementRef.current;
    if (cached && cached.isConnected) return cached;

    const next = getModelsScrollElement(listElementRef.current);
    scrollElementRef.current = next;
    return next;
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize: () => MODELS_GRID_ESTIMATED_ROW_HEIGHT_PX,
    overscan: MODELS_GRID_OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const offsetY = virtualItems[0]?.start ?? 0;
  const totalHeight = virtualizer.getTotalSize();

  return (
    <div ref={listElementRef} className="relative w-full" style={{ height: totalHeight }}>
      <div
        className="absolute top-0 left-0 w-full"
        style={{ transform: `translateY(${offsetY}px)` }}
      >
        {virtualItems.map(function renderVirtualRow(item) {
          const row = rows[item.index];
          if (!row) return null;

          return (
            <div key={row.key} data-index={item.index} ref={virtualizer.measureElement}>
              <div className="grid grid-cols-1 gap-2 pb-2">
                <ModelRow
                  key={row.entry.modelId}
                  entry={row.entry}
                  visible={!row.entry.deprecation && !props.hiddenSet.has(row.entry.modelId)}
                  favorite={props.favoriteSet.has(row.entry.modelId)}
                  onSetVisible={props.onSetVisible}
                  onToggleFavorite={props.onToggleFavorite}
                  disabled={props.disabled}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ModelRowProps = {
  entry: ModelEntry;
  visible: boolean;
  favorite: boolean;
  onSetVisible: (modelId: string, visible: boolean) => void;
  onToggleFavorite: (modelId: string) => void;
  disabled: boolean;
};

type ModelVisibilityToggleProps = {
  checked: boolean;
  disabled: boolean;
  ariaLabel: string;
  onToggle: () => void;
};

const ModelVisibilityToggle = memo(function ModelVisibilityToggle(
  props: ModelVisibilityToggleProps,
) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={props.onToggle}
      className={cn(
        "relative inline-flex h-[18.4px] w-[32px] shrink-0 items-center rounded-full border border-transparent transition-all outline-none",
        "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        props.checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background transition-transform",
          props.checked ? "translate-x-[calc(100%-2px)]" : "translate-x-0",
        )}
      />
    </button>
  );
});

const capabilityMetadata: Record<
  ModelCapabilityKey,
  {
    label: string;
    Icon: typeof BrainIcon;
    className: string;
  }
> = {
  reasoning: {
    label: "Reasoning",
    Icon: BrainIcon,
    className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  },
  webSearch: {
    label: "Web search",
    Icon: GlobeIcon,
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  },
  vision: {
    label: "Vision",
    Icon: EyeIcon,
    className: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  },
  generateImage: {
    label: "Image generation",
    Icon: ImagePlusIcon,
    className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  },
};

const capabilityOrder: Array<ModelCapabilityKey> = [
  "reasoning",
  "webSearch",
  "vision",
  "generateImage",
];

const ModelRow = memo(function ModelRow(props: ModelRowProps) {
  const isDeprecated = props.entry.deprecation !== null;
  const canToggleVisibility = !isDeprecated && !props.disabled;
  const canToggleFavorite = !isDeprecated && !props.disabled;

  const statusLabel = isDeprecated ? "Unavailable" : props.visible ? "Visible" : "Hidden";
  const visibilityToggleLabel = isDeprecated
    ? `${props.entry.displayName} is deprecated and unavailable`
    : `Toggle visibility for ${props.entry.displayName}`;

  function handleFavoriteMouseDown(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleFavoriteClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!canToggleFavorite) return;
    props.onToggleFavorite(props.entry.modelId);
  }

  function handleVisibilityToggle() {
    if (!canToggleVisibility) return;
    props.onSetVisible(props.entry.modelId, !props.visible);
  }

  return (
    <Card className="rounded-md [contain:layout_paint_style] [contain-intrinsic-size:220px] [content-visibility:auto]">
      <CardContent className="space-y-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Icons.provider provider={props.entry.provider} className="size-8 shrink-0" />

            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-sm font-medium">{props.entry.displayName}</div>

                {isDeprecated && (
                  <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">
                    Deprecated
                  </Badge>
                )}
              </div>

              <div className="truncate text-xs text-muted-foreground">
                {props.entry.providerName}
              </div>

              {isDeprecated && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {props.entry.deprecation?.message}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onMouseDown={handleFavoriteMouseDown}
            onClick={handleFavoriteClick}
            disabled={!canToggleFavorite}
            aria-label={
              props.favorite
                ? `Remove ${props.entry.displayName} from favorites`
                : `Favorite ${props.entry.displayName}`
            }
            className={cn(
              "flex size-7 cursor-pointer items-center justify-center rounded-md border text-muted-foreground transition-colors",
              "hover:bg-primary/12 hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50",
              props.favorite && "border-amber-300/40 text-amber-400",
            )}
          >
            <StarIcon className={cn("size-4", props.favorite && "fill-amber-400")} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {capabilityOrder.map((capability) => {
            if (!props.entry.capabilitySet.has(capability)) return null;

            const metadata = capabilityMetadata[capability];
            if (!metadata) return null;

            const Icon = metadata.Icon;

            return (
              <Badge
                key={capability}
                variant="outline"
                className={cn("rounded-sm px-1.5 text-[10px]", metadata.className)}
              >
                <Icon className="size-3" />
                {metadata.label}
              </Badge>
            );
          })}

          {props.favorite && (
            <Badge
              variant="outline"
              className={cn("rounded-sm px-1.5 text-[10px]", STATUS_BADGE_STYLES.favorite)}
            >
              <StarIcon className="size-3 fill-amber-400" />
              Favorite
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{statusLabel}</span>

          <ModelVisibilityToggle
            checked={!isDeprecated && props.visible}
            disabled={!canToggleVisibility}
            ariaLabel={visibilityToggleLabel}
            onToggle={handleVisibilityToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
});
