import { CircleCheckIcon, LayersIcon, MessageSquareIcon, PinIcon, Share2Icon, type LucideIcon } from "lucide-react";

import { LIBRARY_VIEWS, type LibraryView, type ViewCounts } from "./library-search";

import { cn, format } from "@/lib/utils";

const VIEW_TILES = {
  all: {
    label: "All threads",
    hint: "Everything you own",
    Icon: LayersIcon,
    tone: "bg-primary/12 text-primary",
  },
  active: {
    label: "Active",
    hint: "Shown in the sidebar",
    Icon: MessageSquareIcon,
    tone: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  },
  settled: {
    label: "Settled",
    hint: "Done, tucked away",
    Icon: CircleCheckIcon,
    tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  pinned: {
    label: "Pinned",
    hint: "Kept at the top",
    Icon: PinIcon,
    tone: "bg-amber-500/14 text-amber-600 dark:text-amber-400",
  },
  shared: {
    label: "Shared",
    hint: "Has a share link",
    Icon: Share2Icon,
    tone: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  },
} satisfies Record<LibraryView, { label: string; hint: string; Icon: LucideIcon; tone: string }>;

type LibraryOverviewProps = {
  view: LibraryView;
  counts: ViewCounts;
  onViewChange: (view: LibraryView) => void;
};

/** The views double as the page's summary: each tile shows how many threads match the other filters. */
export function LibraryOverview({ view, counts, onViewChange }: LibraryOverviewProps) {
  return (
    <fieldset
      className="-mx-4 flex min-w-0 snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 @2xl:grid @2xl:grid-cols-3 @2xl:overflow-visible @2xl:pb-0 @5xl:grid-cols-5"
    >
      <legend className="sr-only">Thread view</legend>
      {LIBRARY_VIEWS.map((item) => {
        const tile = VIEW_TILES[item];
        const checked = item === view;

        return (
          <button
            key={item}
            type="button"
            aria-pressed={checked}
            aria-label={`${tile.label}: ${format.number(counts[item])}`}
            onClick={() => onViewChange(item)}
            className={cn(
              "group flex min-w-36 shrink-0 snap-start items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 outline-none",
              "hover:border-foreground/20 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
              checked && "border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/30 hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", tile.tone)}>
              <tile.Icon aria-hidden="true" className="size-4.5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-lg leading-6 font-semibold tabular-nums">{format.number(counts[item])}</span>
              <span className="truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{tile.label}</span>
                <span className="hidden @7xl:inline"> · {tile.hint}</span>
              </span>
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
