import {
  ArrowDownAZIcon,
  ArrowUpZAIcon,
  CalendarArrowUpIcon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
} from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

import { cn } from "@/lib/utils";

export type SortOption = "az" | "za" | "newest" | "oldest" | "recently-updated";

const sortOptionExists = {
  az: true,
  za: true,
  newest: true,
  oldest: true,
  "recently-updated": true,
} satisfies Record<SortOption, true>;

function isSortOption(value: string): value is SortOption {
  return value in sortOptionExists;
}

const sortOptions = {
  "recently-updated": { label: "Recently updated", Icon: CalendarArrowUpIcon },
  newest: { label: "Newest", Icon: ClockArrowUpIcon },
  oldest: { label: "Oldest", Icon: ClockArrowDownIcon },
  az: { label: "A-Z", Icon: ArrowDownAZIcon },
  za: { label: "Z-A", Icon: ArrowUpZAIcon },
} satisfies Record<SortOption, { label: string; Icon: typeof ArrowDownAZIcon }>;

const sortOrder: Array<SortOption> = ["recently-updated", "newest", "oldest", "az", "za"];

export function SortSelect({
  value,
  onValueChange,
  className,
}: {
  value: SortOption;
  onValueChange: (value: SortOption) => void;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === null || !isSortOption(nextValue)) return;
        onValueChange(nextValue);
      }}
    >
      <SelectTrigger className={cn("h-9 text-xs", className)}>
        <div className="flex flex-1 items-center gap-2 text-left">
          <span className="text-muted-foreground">Sort</span>
          <span className="truncate">{sortOptions[value].label}</span>
        </div>
      </SelectTrigger>

      <SelectContent>
        {sortOrder.map((key) => {
          const option = sortOptions[key];
          const Icon = option.Icon;

          return (
            <SelectItem key={key} value={key}>
              <Icon className="size-4" />
              <span>{option.label}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
