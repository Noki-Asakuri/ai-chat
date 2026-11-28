import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { UNGROUPED_COLOR } from "./group-colors";
import { useDraftValue } from "./use-draft-value";
import {
  ALL_GROUPS,
  DATE_PRESETS,
  LIBRARY_SEARCH_DEFAULTS,
  LIBRARY_SORTS,
  LIBRARY_STATUSES,
  UNGROUPED,
  countPopoverFilters,
  getPresetRange,
  isLibraryDateField,
  isLibraryStatus,
  type LibraryGroup,
  type LibrarySearch,
  type LibrarySort,
  type LibraryStatus,
} from "./library-search";

import { cn, format } from "@/lib/utils";

type GroupColors = ReadonlyMap<string, { dot: string }>;

type LibraryToolbarProps = {
  search: LibrarySearch;
  groups: ReadonlyArray<LibraryGroup>;
  groupColors: GroupColors;
  matchCount: number;
  totalCount: number;
  uncountedCount: number;
  now: number;
  onChange: (patch: Partial<LibrarySearch>) => void;
};

const STATUS_LABELS = {
  all: "Any",
  running: "Running",
  complete: "Complete",
  error: "Error",
} satisfies Record<LibraryStatus, string>;

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function formatDay(value: string): string {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);
  return shortDate.format(new Date(year, month - 1, day));
}

function formatRange(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return min === max ? `${min}` : `${min}–${max}`;
  if (min !== undefined) return `${min}+`;
  return `≤ ${max}`;
}

function parseCount(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function GroupDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", className)} />;
}

export function LibraryToolbar(props: LibraryToolbarProps) {
  const { search, groups, groupColors, onChange } = props;
  const [query, setQuery] = useDraftValue(search.q, (q) => onChange({ q }));
  const groupTitle = (id: string) => groups.find((group) => group._id === id)?.title;

  const groupLabel = (value: string): ReactNode => {
    if (value === ALL_GROUPS) return "All groups";
    if (value === UNGROUPED) return "Ungrouped";
    return groupTitle(value) ?? "All groups";
  };

  const chips: Array<{ key: string; label: ReactNode; clear: Partial<LibrarySearch> }> = [];
  if (search.group !== ALL_GROUPS) {
    const dot = search.group === UNGROUPED ? UNGROUPED_COLOR.dot : groupColors.get(search.group)?.dot;
    chips.push({
      key: "group",
      label: (
        <>
          {dot && <GroupDot className={dot} />}
          {groupLabel(search.group)}
        </>
      ),
      clear: { group: ALL_GROUPS },
    });
  }
  if (search.status !== "all") {
    chips.push({ key: "status", label: `Status: ${STATUS_LABELS[search.status]}`, clear: { status: "all" } });
  }
  if (search.from !== undefined || search.to !== undefined) {
    const field = search.date === "created" ? "Created" : "Updated";
    const range =
      search.from && search.to
        ? search.from === search.to
          ? `on ${formatDay(search.from)}`
          : `${formatDay(search.from)} – ${formatDay(search.to)}`
        : search.from
          ? `after ${formatDay(search.from)}`
          : `before ${formatDay(search.to ?? "")}`;
    chips.push({ key: "date", label: `${field} ${range}`, clear: { from: undefined, to: undefined } });
  }
  if (search.msgMin !== undefined || search.msgMax !== undefined) {
    chips.push({
      key: "messages",
      label: `Messages: ${formatRange(search.msgMin, search.msgMax)}`,
      clear: { msgMin: undefined, msgMax: undefined },
    });
  }
  if (search.attMin !== undefined || search.attMax !== undefined) {
    chips.push({
      key: "attachments",
      label: `Attachments: ${formatRange(search.attMin, search.attMax)}`,
      clear: { attMin: undefined, attMax: undefined },
    });
  }

  const filtered = props.matchCount !== props.totalCount;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 @3xl:flex-row @3xl:items-center">
        <InputGroup className="h-9 @3xl:max-w-sm">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search thread titles"
            placeholder="Search titles…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="text-sm md:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query.length > 0 && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setQuery("")}>
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={search.group} onValueChange={(value) => value !== null && onChange({ group: value })}>
            <SelectTrigger aria-label="Filter by group" className="h-9 min-w-0 flex-1 @3xl:w-44 @3xl:flex-none">
              <SelectValue>
                {(value: string) => {
                  const dot = value === UNGROUPED ? UNGROUPED_COLOR.dot : groupColors.get(value)?.dot;
                  return (
                    <span className="flex min-w-0 items-center gap-2">
                      {dot && <GroupDot className={dot} />}
                      <span className="truncate">{groupLabel(value)}</span>
                    </span>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} align="start" className="min-w-48">
              <SelectGroup>
                <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
                <SelectItem value={UNGROUPED}>
                  <GroupDot className={UNGROUPED_COLOR.dot} />
                  Ungrouped
                </SelectItem>
              </SelectGroup>
              {groups.length > 0 && <SelectSeparator />}
              <SelectGroup>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group._id}>
                    <GroupDot className={groupColors.get(group._id)?.dot ?? UNGROUPED_COLOR.dot} />
                    <span className="truncate">{group.title}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <FiltersPopover search={search} now={props.now} onChange={onChange} />
          <SortControl search={search} onChange={onChange} />
        </div>

        <p aria-live="polite" className="text-xs text-muted-foreground @3xl:ml-auto">
          {filtered ? (
            <>
              <span className="font-medium text-foreground tabular-nums">{format.number(props.matchCount)}</span> of{" "}
              {format.number(props.totalCount)} threads
            </>
          ) : (
            <>
              <span className="font-medium text-foreground tabular-nums">{format.number(props.totalCount)}</span>{" "}
              {props.totalCount === 1 ? "thread" : "threads"}
            </>
          )}
        </p>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-muted/50 pr-1 pl-2.5 text-xs font-medium"
            >
              {chip.label}
              <button
                type="button"
                aria-label="Remove filter"
                onClick={() => onChange(chip.clear)}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() =>
              onChange({
                group: ALL_GROUPS,
                status: "all",
                from: undefined,
                to: undefined,
                msgMin: undefined,
                msgMax: undefined,
                attMin: undefined,
                attMax: undefined,
              })
            }
          >
            Clear all
          </Button>
        </div>
      )}

      {props.uncountedCount > 0 && (search.msgMin !== undefined || search.msgMax !== undefined) && (
        <p className="text-xs text-muted-foreground">
          {format.number(props.uncountedCount)} older {props.uncountedCount === 1 ? "thread hasn't" : "threads haven't"}{" "}
          had {props.uncountedCount === 1 ? "its" : "their"} messages counted yet, so the message filter leaves them out.
        </p>
      )}
    </div>
  );
}

type FiltersPopoverProps = {
  search: LibrarySearch;
  now: number;
  onChange: (patch: Partial<LibrarySearch>) => void;
};

function FiltersPopover({ search, now, onChange }: FiltersPopoverProps) {
  const activeCount = countPopoverFilters(search);
  const fromId = useId();
  const toId = useId();
  const activePreset = DATE_PRESETS.find((preset) => {
    const range = getPresetRange(preset.days, now);
    return search.from === range.from && search.to === range.to;
  });

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className={cn("h-9 shrink-0", activeCount > 0 && "border-primary/40 bg-primary/5")} />
        }
      >
        <ListFilterIcon />
        Filters
        {activeCount > 0 && (
          <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold text-primary-foreground tabular-nums">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" includeArrow={false} className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0">
        <FilterSection title="Status">
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[search.status]}
            onValueChange={(values) => {
              const next = values[0];
              if (isLibraryStatus(next)) onChange({ status: next });
            }}
            aria-label="Status"
            className="w-full *:flex-1"
          >
            {LIBRARY_STATUSES.map((status) => (
              <ToggleGroupItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FilterSection>

        <FilterSection
          title="Date"
          action={
            <ToggleGroup
              variant="outline"
              size="sm"
              value={[search.date]}
              onValueChange={(values) => {
                const next = values[0];
                if (isLibraryDateField(next)) onChange({ date: next });
              }}
              aria-label="Date to filter by"
            >
              <ToggleGroupItem value="updated" className="h-6 px-2 text-[0.6875rem]">
                Updated
              </ToggleGroupItem>
              <ToggleGroupItem value="created" className="h-6 px-2 text-[0.6875rem]">
                Created
              </ToggleGroupItem>
            </ToggleGroup>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={activePreset?.id === preset.id ? "secondary" : "outline"}
                size="xs"
                aria-pressed={activePreset?.id === preset.id}
                onClick={() => onChange(getPresetRange(preset.days, now))}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={fromId} className="text-[0.6875rem] text-muted-foreground">
                From
              </label>
              <Input
                id={fromId}
                type="date"
                value={search.from ?? ""}
                max={search.to}
                onChange={(event) => onChange({ from: event.target.value || undefined })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={toId} className="text-[0.6875rem] text-muted-foreground">
                To
              </label>
              <Input
                id={toId}
                type="date"
                value={search.to ?? ""}
                min={search.from}
                onChange={(event) => onChange({ to: event.target.value || undefined })}
              />
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Messages">
          <RangeInputs
            label="messages"
            min={search.msgMin}
            max={search.msgMax}
            onMinChange={(msgMin) => onChange({ msgMin })}
            onMaxChange={(msgMax) => onChange({ msgMax })}
          />
        </FilterSection>

        <FilterSection title="Attachments">
          <RangeInputs
            label="attachments"
            min={search.attMin}
            max={search.attMax}
            onMinChange={(attMin) => onChange({ attMin })}
            onMaxChange={(attMax) => onChange({ attMax })}
          />
        </FilterSection>

        <div className="flex items-center justify-between border-t px-3 py-2">
          <span className="text-[0.6875rem] text-muted-foreground">
            {activeCount === 0 ? "No filters applied" : `${activeCount} applied`}
          </span>
          <Button
            variant="ghost"
            size="xs"
            disabled={activeCount === 0}
            onClick={() =>
              onChange({
                status: LIBRARY_SEARCH_DEFAULTS.status,
                from: undefined,
                to: undefined,
                msgMin: undefined,
                msgMax: undefined,
                attMin: undefined,
                attMax: undefined,
              })
            }
          >
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-b px-3 py-3 last-of-type:border-b-0">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <legend className="text-xs font-medium">{title}</legend>
        {action}
      </div>
      {children}
    </fieldset>
  );
}

type RangeInputsProps = {
  label: string;
  min: number | undefined;
  max: number | undefined;
  onMinChange: (min: number | undefined) => void;
  onMaxChange: (max: number | undefined) => void;
};

function RangeInputs({ label, min, max, onMinChange, onMaxChange }: RangeInputsProps) {
  return (
    <div className="flex items-center gap-2">
      <CountInput label={`Minimum ${label}`} placeholder="Min" value={min} onChange={onMinChange} />
      <span aria-hidden="true" className="text-muted-foreground">
        –
      </span>
      <CountInput label={`Maximum ${label}`} placeholder="Max" value={max} onChange={onMaxChange} />
    </div>
  );
}

type CountInputProps = {
  label: string;
  placeholder: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
};

function CountInput({ label, placeholder, value, onChange }: CountInputProps) {
  const [draft, setDraft] = useDraftValue(value === undefined ? "" : String(value), (next) =>
    onChange(parseCount(next)),
  );

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      placeholder={placeholder}
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

const SORT_LABELS = {
  updated: "Last updated",
  created: "Created",
  title: "Title",
  group: "Group",
  status: "Status",
  messages: "Messages",
  attachments: "Files",
} satisfies Record<LibrarySort, string>;

/** The column headers sort the table, but narrow layouts hide most of them, so this stands in. */
function SortControl({ search, onChange }: { search: LibrarySearch; onChange: (patch: Partial<LibrarySearch>) => void }) {
  const ascending = search.dir === "asc";

  return (
    <div className="flex items-center gap-1 @6xl:hidden">
      <Select
        value={search.sort}
        onValueChange={(value) => {
          const sort = LIBRARY_SORTS.find((item) => item === value);
          if (sort) onChange({ sort });
        }}
      >
        <SelectTrigger aria-label="Sort by" className="h-9 w-auto">
          <ArrowUpDownIcon aria-hidden="true" className="text-muted-foreground" />
          <SelectValue>{(value: LibrarySort) => SORT_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="end">
          <SelectGroup>
            {LIBRARY_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label={ascending ? "Sorted ascending; sort descending" : "Sorted descending; sort ascending"}
        onClick={() => onChange({ dir: ascending ? "desc" : "asc" })}
      >
        {ascending ? <ArrowUpIcon /> : <ArrowDownIcon />}
      </Button>
    </div>
  );
}
