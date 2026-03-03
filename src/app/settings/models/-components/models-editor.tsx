import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import type {
  AllModelIds as ModelId,
  ModelDeprecation,
  ModelIdKey,
  Provider,
} from "@/lib/chat/models";
import { AllModelIds, getModelData, prettifyProviderName } from "@/lib/chat/models";

type ModelEntry = {
  modelId: ModelId;
  provider: Provider;
  providerName: string;
  displayName: string;
  deprecation: ModelDeprecation | null;
  searchText: string;
};

const MODEL_ENTRIES: Array<ModelEntry> = AllModelIds.slice()
  .sort((a, b) => a.localeCompare(b))
  .map((modelId) => {
    const data = getModelData(modelId);

    const displayName = data.display.unique ?? data.display.name;
    const providerName = prettifyProviderName(data.provider);
    const deprecation = data.deprecation ?? null;

    const searchText =
      `${displayName} ${data.provider} ${providerName} ${deprecation?.message ?? ""}`.toLowerCase();

    return {
      modelId,
      provider: data.provider,
      providerName,
      displayName,
      deprecation,
      searchText,
    };
  });

const SELECTABLE_MODEL_ID_SET: ReadonlySet<string> = new Set<string>(
  MODEL_ENTRIES.filter((entry) => entry.deprecation === null).map((entry) => entry.modelId),
);

function isModelIdKey(value: string): value is ModelIdKey {
  const slashIndex = value.indexOf("/");
  if (slashIndex <= 0) return false;

  const provider = value.slice(0, slashIndex);
  return provider === "google" || provider === "openai" || provider === "deepseek";
}

function sanitizeHiddenModels(hiddenModels: string[]): Set<string> {
  const sanitized = new Set<string>();

  for (const modelId of hiddenModels) {
    if (!isModelIdKey(modelId)) continue;
    if (!SELECTABLE_MODEL_ID_SET.has(modelId)) continue;
    sanitized.add(modelId);
  }

  return sanitized;
}

function toHiddenModelsPayload(hiddenSet: ReadonlySet<string>): string[] {
  const next: string[] = [];

  for (const modelId of hiddenSet) {
    if (!isModelIdKey(modelId)) continue;
    if (!SELECTABLE_MODEL_ID_SET.has(modelId)) continue;
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

export type ModelsEditorProps = {
  disabled: boolean;
  initialHiddenModels: string[];
  onSave: (hiddenModels: string[]) => void;
};

export function ModelsEditor(props: ModelsEditorProps) {
  const [query, setQuery] = useState("");
  const [visibleOnly, setVisibleOnly] = useState(false);

  const [hiddenSet, setHiddenSet] = useState<Set<string>>(() =>
    sanitizeHiddenModels(props.initialHiddenModels),
  );

  useEffect(() => {
    setHiddenSet(sanitizeHiddenModels(props.initialHiddenModels));
  }, [props.initialHiddenModels]);

  const initialHiddenSet = useMemo(
    () => sanitizeHiddenModels(props.initialHiddenModels),
    [props.initialHiddenModels],
  );

  const dirty = useMemo(
    () => !setsEqual(hiddenSet, initialHiddenSet),
    [hiddenSet, initialHiddenSet],
  );

  const onSetVisible = useCallback(function onSetVisible(modelId: string, visible: boolean) {
    setHiddenSet((prev) => {
      if (!isModelIdKey(modelId)) return prev;
      if (!SELECTABLE_MODEL_ID_SET.has(modelId)) return prev;

      const next = new Set(prev);
      if (visible) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }, []);

  const onReset = useCallback(function onReset() {
    setHiddenSet(new Set());
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredModels = useMemo(() => {
    const result: Array<ModelEntry> = [];

    for (const entry of MODEL_ENTRIES) {
      if (normalizedQuery && !entry.searchText.includes(normalizedQuery)) continue;

      if (visibleOnly && (entry.deprecation || hiddenSet.has(entry.modelId))) continue;

      result.push(entry);
    }

    return result;
  }, [hiddenSet, normalizedQuery, visibleOnly]);

  const deprecatedCount = useMemo(() => {
    let count = 0;

    for (const entry of MODEL_ENTRIES) {
      if (entry.deprecation) count += 1;
    }

    return count;
  }, []);

  const hiddenCount = useMemo(() => {
    let count = 0;

    for (const entry of MODEL_ENTRIES) {
      if (entry.deprecation) continue;
      if (hiddenSet.has(entry.modelId)) count += 1;
    }

    return count;
  }, [hiddenSet]);

  const visibleCount = MODEL_ENTRIES.length - deprecatedCount - hiddenCount;

  const shownHiddenCount = useMemo(() => {
    let count = 0;

    for (const entry of filteredModels) {
      if (entry.deprecation) continue;
      if (hiddenSet.has(entry.modelId)) count += 1;
    }

    return count;
  }, [filteredModels, hiddenSet]);

  const shownDeprecatedCount = useMemo(() => {
    let count = 0;

    for (const entry of filteredModels) {
      if (entry.deprecation) count += 1;
    }

    return count;
  }, [filteredModels]);

  const shownVisibleCount = filteredModels.length - shownHiddenCount - shownDeprecatedCount;

  return (
    <Card className="rounded-md">
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {visibleCount} visible • {hiddenCount} hidden • {deprecatedCount} deprecated
            </span>
            <span className="text-xs text-muted-foreground">
              Showing {shownVisibleCount} visible
              {shownHiddenCount ? `, ${shownHiddenCount} hidden` : ""}
              {shownDeprecatedCount ? `, ${shownDeprecatedCount} deprecated` : ""} in the current
              filter.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={props.disabled || !dirty}
              onClick={() => props.onSave(toHiddenModelsPayload(hiddenSet))}
            >
              Save changes
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={props.disabled || hiddenSet.size === 0}
              onClick={onReset}
            >
              Show all
            </Button>
          </div>
        </div>

        <ModelsFilter
          query={query}
          onQueryChange={setQuery}
          visibleOnly={visibleOnly}
          onVisibleOnlyChange={setVisibleOnly}
          disabled={props.disabled}
        />

        <Separator />

        <ModelsGrid models={filteredModels} hiddenSet={hiddenSet} onSetVisible={onSetVisible} />
      </CardContent>
    </Card>
  );
}

type ModelsFilterProps = {
  query: string;
  onQueryChange: (value: string) => void;
  visibleOnly: boolean;
  onVisibleOnlyChange: (value: boolean) => void;
  disabled: boolean;
};

function ModelsFilter(props: ModelsFilterProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="model-search">Search models</Label>
        <Input
          id="model-search"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="Search by name or provider…"
          className="bg-input/30 outline-none"
          disabled={props.disabled}
        />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="visible-only" className="text-sm leading-none font-medium">
            Visible only
          </Label>
          <p className="text-sm text-muted-foreground">Hide already-hidden models from the list.</p>
        </div>

        <Switch
          id="visible-only"
          checked={props.visibleOnly}
          onCheckedChange={props.onVisibleOnlyChange}
          disabled={props.disabled}
          aria-label="Show visible models only"
        />
      </div>
    </div>
  );
}

type ModelsGridProps = {
  models: Array<ModelEntry>;
  hiddenSet: ReadonlySet<string>;
  onSetVisible: (modelId: string, visible: boolean) => void;
};

function ModelsGrid(props: ModelsGridProps) {
  if (props.models.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
        No models match your filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {props.models.map((entry) => (
        <ModelRow
          key={entry.modelId}
          entry={entry}
          visible={!entry.deprecation && !props.hiddenSet.has(entry.modelId)}
          onSetVisible={props.onSetVisible}
        />
      ))}
    </div>
  );
}

type ModelRowProps = {
  entry: ModelEntry;
  visible: boolean;
  onSetVisible: (modelId: string, visible: boolean) => void;
};

const ModelRow = memo(function ModelRow(props: ModelRowProps) {
  const isDeprecated = props.entry.deprecation !== null;

  return (
    <Card className="rounded-md">
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <Icons.provider provider={props.entry.provider} className="size-8 shrink-0" />

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-sm">{props.entry.displayName}</div>
              {isDeprecated && (
                <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">
                  Deprecated
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{props.entry.providerName}</div>
            {isDeprecated && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {props.entry.deprecation?.message}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs">
            {isDeprecated ? "Unavailable" : props.visible ? "Visible" : "Hidden"}
          </span>
          <Switch
            checked={isDeprecated ? false : props.visible}
            onCheckedChange={(next) => props.onSetVisible(props.entry.modelId, next)}
            disabled={isDeprecated}
            aria-label={
              isDeprecated
                ? `${props.entry.displayName} is deprecated and unavailable`
                : `Toggle visibility for ${props.entry.displayName}`
            }
          />
        </div>
      </CardContent>
    </Card>
  );
});
