import { useState, useTransition } from "react";
import {
  BrainIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImageIcon,
  ImagePlusIcon,
  SearchIcon,
  StarIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { compareModelLabelsNewestFirst } from "@/components/chat-textarea/model-selector-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Icons } from "@/components/ui/icons";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "@/components/ui/toast";
import { AllModelIds, getModelData, prettifyProviderName, type ModelData } from "@/lib/chat/models";
import { cn, tryCatch } from "@/lib/utils";
import { AutosaveStatus } from "../../-components/autosave-status";

const CAPABILITIES = [
  {
    value: "reasoning",
    label: "Reasoning",
    Icon: BrainIcon,
    color: "text-violet-700 dark:text-violet-300",
    supports: (model: ModelData) => !!model.capabilities.reasoning,
  },
  {
    value: "tools",
    label: "Tools",
    Icon: WrenchIcon,
    color: "text-cyan-700 dark:text-cyan-300",
    supports: (model: ModelData) => !!model.capabilities.toolCalling,
  },
  {
    value: "imageInput",
    label: "Image input",
    Icon: ImageIcon,
    color: "text-teal-700 dark:text-teal-300",
    supports: (model: ModelData) => model.modalities.input.includes("image"),
  },
  {
    value: "pdfInput",
    label: "PDF input",
    Icon: FileTextIcon,
    color: "text-sky-700 dark:text-sky-300",
    supports: (model: ModelData) => model.modalities.input.includes("pdf"),
  },
  {
    value: "imageOutput",
    label: "Image output",
    Icon: ImagePlusIcon,
    color: "text-orange-700 dark:text-orange-300",
    supports: (model: ModelData) => model.modalities.output.includes("image"),
  },
  {
    value: "imageGeneration",
    label: "Image generation tool",
    Icon: ImagePlusIcon,
    color: "text-orange-700 dark:text-orange-300",
    supports: (model: ModelData) => !!model.capabilities.imageGeneration,
  },
];

const MODELS = AllModelIds.map((modelId) => {
  const model = getModelData(modelId);
  const name = model.display.unique ?? model.display.name;
  return {
    modelId,
    model,
    name,
    capabilities: CAPABILITIES.filter((capability) => capability.supports(model)),
    searchText: `${modelId} ${name} ${prettifyProviderName(model.provider)}`.toLowerCase(),
    addedAt: model.addedAt ? Date.parse(model.addedAt) : 0,
  };
});
const PROVIDERS = [
  { value: "all", label: "All providers", icon: null },
  ...Array.from(new Set(MODELS.map(({ model }) => model.provider))).map((provider) => ({
    value: provider,
    label: prettifyProviderName(provider),
    icon: <Icons.provider provider={provider} className="size-4 shrink-0" />,
  })),
];
const PICKER_OPTIONS = [
  { value: "all", label: "Picker: all" },
  { value: "included", label: "Picker: included" },
  { value: "excluded", label: "Picker: excluded" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest by provider" },
  { value: "name", label: "Name A–Z" },
  { value: "provider", label: "Provider" },
];
const NEW_MODEL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ModelsCustomization = { hidden: string[]; favorite: string[] };
export type ModelsEditorProps = {
  disabled: boolean;
  initialHiddenModels: string[];
  initialFavoriteModels: string[];
  onSaveCustomization: (customization: Partial<ModelsCustomization>) => Promise<void>;
};

export function ModelsEditor(props: ModelsEditorProps) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [picker, setPicker] = useState("all");
  const [sort, setSort] = useState("newest");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [includeDeprecated, setIncludeDeprecated] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [now] = useState(() => Date.now());
  const [saving, startSaving] = useTransition();
  const hidden = new Set(props.initialHiddenModels);
  const favorites = new Set(props.initialFavoriteModels);
  const searchTerms = query.trim().toLowerCase().split(/\s+/);
  const hasFilters =
    !!query ||
    provider !== "all" ||
    picker !== "all" ||
    favoritesOnly ||
    newOnly ||
    includeDeprecated ||
    capabilities.length > 0;

  function isNew(entry: (typeof MODELS)[number]) {
    return (
      !entry.model.deprecation &&
      entry.addedAt > 0 &&
      entry.addedAt <= now &&
      now - entry.addedAt < NEW_MODEL_WINDOW_MS
    );
  }

  const models = MODELS.filter((entry) => {
    const deprecated = !!entry.model.deprecation;
    const included = !deprecated && !hidden.has(entry.modelId);
    return (
      (!deprecated || includeDeprecated || favorites.has(entry.modelId)) &&
      searchTerms.every((term) => entry.searchText.includes(term)) &&
      (provider === "all" || entry.model.provider === provider) &&
      (picker === "all" || (picker === "included" ? included : !included)) &&
      (!favoritesOnly || favorites.has(entry.modelId)) &&
      (!newOnly || isNew(entry)) &&
      capabilities.every((value) => entry.capabilities.some((capability) => capability.value === value))
    );
  }).toSorted((a, b) => {
    if (sort !== "name" && a.model.provider !== b.model.provider) {
      return prettifyProviderName(a.model.provider).localeCompare(prettifyProviderName(b.model.provider));
    }
    if (sort !== "name") {
      if (a.addedAt !== b.addedAt) return b.addedAt - a.addedAt;
      // ponytail: undated catalog entries use the picker's version heuristic; add dates for release ordering.
      return compareModelLabelsNewestFirst({ label: a.name }, { label: b.name });
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  function clearFilters() {
    setQuery("");
    setProvider("all");
    setPicker("all");
    setFavoritesOnly(false);
    setNewOnly(false);
    setIncludeDeprecated(false);
    setCapabilities([]);
  }

  function save(kind: keyof ModelsCustomization, modelId: string, selected: boolean) {
    if (props.disabled) return;
    const values = new Set(kind === "hidden" ? props.initialHiddenModels : props.initialFavoriteModels);
    if (selected) values.add(modelId);
    else values.delete(modelId);
    startSaving(async () => {
      const [, error] = await tryCatch(props.onSaveCustomization({ [kind]: [...values] }));
      if (error)
        toast.error("Couldn't save model preferences", {
          description: "The change was reverted. Try again.",
        });
    });
  }

  return (
    <section aria-label="Model catalog" className="flex min-w-0 flex-col">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background pt-1 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="h-10 min-w-48 flex-1">
            <InputGroupInput
              aria-label="Search models"
              placeholder="Search models…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            {query && (
              <InputGroupAddon align="inline-end">
                <Button variant="ghost" size="icon-sm" aria-label="Clear search" onClick={() => setQuery("")}>
                  <XIcon />
                </Button>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Select items={SORT_OPTIONS} value={sort} onValueChange={(value) => value && setSort(value)}>
            <SelectTrigger aria-label="Sort models" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select items={PROVIDERS} value={provider} onValueChange={(value) => value && setProvider(value)}>
            <SelectTrigger aria-label="Filter by provider">
              <SelectValue>
                {PROVIDERS.find((option) => option.value === provider)?.icon}
                {PROVIDERS.find((option) => option.value === provider)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PROVIDERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.icon}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  Capabilities{capabilities.length > 0 ? ` (${capabilities.length})` : ""}
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              }
            />
            <DropdownMenuContent className="min-w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Match all selected</DropdownMenuLabel>
                {CAPABILITIES.map(({ value, label, Icon, color }) => (
                  <DropdownMenuCheckboxItem
                    key={value}
                    checked={capabilities.includes(value)}
                    closeOnClick={false}
                    onCheckedChange={(checked) =>
                      setCapabilities((previous) =>
                        checked ? [...previous, value] : previous.filter((item) => item !== value),
                      )
                    }
                  >
                    <Icon className={color} />
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Select items={PICKER_OPTIONS} value={picker} onValueChange={(value) => value && setPicker(value)}>
            <SelectTrigger aria-label="Filter by picker inclusion">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PICKER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Toggle
            className="aria-pressed:border-amber-500/40 aria-pressed:bg-amber-500/10 aria-pressed:text-amber-700 dark:aria-pressed:text-amber-300"
            variant="outline"
            pressed={favoritesOnly}
            onPressedChange={setFavoritesOnly}
          >
            <StarIcon className="text-amber-600 dark:text-amber-400" />
            Favorites
          </Toggle>
          <Toggle
            className="aria-pressed:border-emerald-500/40 aria-pressed:bg-emerald-500/10 aria-pressed:text-emerald-700 dark:aria-pressed:text-emerald-300"
            variant="outline"
            pressed={newOnly}
            onPressedChange={setNewOnly}
          >
            New
          </Toggle>
          <Toggle
            className="aria-pressed:border-rose-500/40 aria-pressed:bg-rose-500/10 aria-pressed:text-rose-700 dark:aria-pressed:text-rose-300"
            variant="outline"
            pressed={includeDeprecated}
            onPressedChange={setIncludeDeprecated}
          >
            Include deprecated
          </Toggle>
        </div>
        {capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {CAPABILITIES.filter(({ value }) => capabilities.includes(value)).map(
              ({ value, label, Icon, color }) => (
                <Button
                  key={value}
                  variant="secondary"
                  size="sm"
                  onClick={() => setCapabilities((previous) => previous.filter((item) => item !== value))}
                  aria-label={`Remove ${label} filter`}
                >
                  <Icon className={color} data-icon="inline-start" />
                  {label}
                  <XIcon data-icon="inline-end" />
                </Button>
              ),
            )}
          </div>
        )}
        <div className="flex min-h-7 items-center gap-3 text-xs text-muted-foreground">
          <output className="tabular-nums">
            {models.length} {models.length === 1 ? "model" : "models"}
          </output>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <div className="ml-auto">
            <AutosaveStatus isSaving={saving} />
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-3 border-b px-2 py-2 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        <span className="flex-1">Model</span>
        <span className="hidden sm:block">Capabilities</span>
        <span className="w-11 text-center">Star</span>
        <span className="w-16 text-center">In picker</span>
      </div>
      {models.length === 0 ? (
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyTitle>No models match your filters</EmptyTitle>
          </EmptyHeader>
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </Empty>
      ) : (
        <ul className="divide-y">
          {models.map((entry) => (
            <ModelRow
              key={entry.modelId}
              entry={entry}
              isNew={isNew(entry)}
              favorite={favorites.has(entry.modelId)}
              included={!entry.model.deprecation && !hidden.has(entry.modelId)}
              disabled={props.disabled}
              onSave={save}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ModelRow({
  entry,
  isNew,
  favorite,
  included,
  disabled,
  onSave,
}: {
  entry: (typeof MODELS)[number];
  isNew: boolean;
  favorite: boolean;
  included: boolean;
  disabled: boolean;
  onSave: (kind: keyof ModelsCustomization, modelId: string, selected: boolean) => void;
}) {
  const deprecation = entry.model.deprecation;
  const replacement = deprecation ? getModelData(deprecation.replacementModelId) : null;
  return (
    <li>
      <Collapsible>
        <div className="flex min-h-14 items-center gap-3 px-2 hover:bg-muted/40">
          <CollapsibleTrigger
            className="group flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Details for ${entry.name}`}
          >
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground group-data-panel-open:rotate-90" />
            <Icons.provider provider={entry.model.provider} className="size-4 shrink-0" />
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-2">
              <span className="text-sm font-medium wrap-anywhere">{entry.name}</span>
              {isNew && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  New
                </Badge>
              )}
              {deprecation && (
                <Badge
                  variant="outline"
                  className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                >
                  Deprecated
                </Badge>
              )}
            </span>
          </CollapsibleTrigger>
          <div className="hidden items-center gap-2 text-muted-foreground sm:flex">
            {entry.capabilities.map(({ value, label, Icon, color }) => (
              <span key={value} title={label} className={color}>
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </span>
            ))}
          </div>
          <Toggle
            className="size-11 shrink-0"
            pressed={favorite}
            disabled={disabled || (!!deprecation && !favorite)}
            onPressedChange={(pressed) => onSave("favorite", entry.modelId, pressed)}
            aria-label={`${favorite ? "Remove" : "Add"} ${entry.name} ${favorite ? "from" : "to"} favorites`}
          >
            <StarIcon className={cn(favorite && "fill-current text-amber-600 dark:text-amber-400")} />
          </Toggle>
          <div className="flex h-11 w-16 shrink-0 items-center justify-center">
            {!deprecation && (
              <Switch
                checked={included}
                disabled={disabled}
                onCheckedChange={(checked) => onSave("hidden", entry.modelId, !checked)}
                aria-label={`Include ${entry.name} in picker`}
              />
            )}
          </div>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-3 bg-muted/20 px-8 py-4 text-xs">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Provider</dt>
              <dd>{prettifyProviderName(entry.model.provider)}</dd>
              <dt className="text-muted-foreground">Model ID</dt>
              <dd className="font-mono break-all">{entry.modelId}</dd>
              {entry.model.addedAt && (
                <>
                  <dt className="text-muted-foreground">Added</dt>
                  <dd>
                    <time dateTime={entry.model.addedAt}>{entry.model.addedAt}</time>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Input</dt>
              <dd>{entry.model.modalities.input.join(", ")}</dd>
              <dt className="text-muted-foreground">Output</dt>
              <dd>{entry.model.modalities.output.join(", ")}</dd>
            </dl>
            {entry.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {entry.capabilities.map(({ value, label, Icon, color }) => (
                  <Badge key={value} variant="outline" className={color}>
                    <Icon />
                    {label}
                  </Badge>
                ))}
              </div>
            )}
            {deprecation && <p className="text-muted-foreground">{deprecation.message}</p>}
            {replacement && (
              <p>
                Replacement:{" "}
                <span className="font-medium">{replacement.display.unique ?? replacement.display.name}</span>
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
