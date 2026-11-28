import type { Id } from "@ai-chat/backend/convex/_generated/dataModel";

import {
  CircleCheckIcon,
  EllipsisIcon,
  FolderIcon,
  FolderInputIcon,
  Loader2Icon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { LibraryGroup } from "./library-search";

import { cn, format } from "@/lib/utils";

export type BulkAction =
  | { type: "pin"; pinned: boolean }
  | { type: "settle" }
  | { type: "unsettle" }
  | { type: "move"; groupId: Id<"groups"> | null };

type LibraryBulkBarProps = {
  selectedCount: number;
  matchCount: number;
  groups: ReadonlyArray<LibraryGroup>;
  groupColors: ReadonlyMap<string, { dot: string }>;
  pending: boolean;
  onAction: (action: BulkAction) => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onClear: () => void;
};

/**
 * Floats over the bottom of the list while threads are selected. Its room is reserved whether or not
 * anything is selected, so selecting a thread never moves the rows around it.
 */
export function LibraryBulkBar(props: LibraryBulkBarProps) {
  const open = props.selectedCount > 0;

  return (
    // Always the bar's height, so at the end of the list the bar never covers the pagination above it.
    <div className="pointer-events-none sticky bottom-3 z-30 -mt-1 h-12">
      <div
        role="toolbar"
        aria-label="Selected threads"
        aria-hidden={!open}
        inert={!open}
        data-open={open}
        className={cn(
          "absolute bottom-0 left-1/2 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-0.5 rounded-xl sm:gap-1 border bg-popover/95 p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/5 backdrop-blur",
          "translate-y-3 opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
          "data-[open=true]:pointer-events-auto data-[open=true]:translate-y-0 data-[open=true]:opacity-100",
        )}
      >
        <div className="flex items-center gap-2 pr-1 pl-2">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
            {format.number(props.selectedCount)}
          </span>
          <span className="hidden text-xs font-medium sm:inline">selected</span>
          {props.selectedCount < props.matchCount && (
            <Button variant="link" size="xs" className="h-6 px-1" onClick={props.onSelectAll}>
              <span className="sm:hidden">All {format.number(props.matchCount)}</span>
              <span className="hidden sm:inline">Select all {format.number(props.matchCount)}</span>
            </Button>
          )}
        </div>

        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />

        <BarButton
          Icon={PinIcon}
          label="Pin"
          className="hidden sm:inline-flex"
          disabled={props.pending}
          onClick={() => props.onAction({ type: "pin", pinned: true })}
        />
        <BarButton
          Icon={PinOffIcon}
          label="Unpin"
          className="hidden sm:inline-flex"
          disabled={props.pending}
          onClick={() => props.onAction({ type: "pin", pinned: false })}
        />
        <BarButton
          Icon={CircleCheckIcon}
          label="Settle"
          disabled={props.pending}
          onClick={() => props.onAction({ type: "settle" })}
        />
        <BarButton
          Icon={Undo2Icon}
          label="Unsettle"
          className="hidden sm:inline-flex"
          disabled={props.pending}
          onClick={() => props.onAction({ type: "unsettle" })}
        />

        {/* Phones don't have room for every button, so the less common ones collapse into a menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={props.pending}
            render={<Button variant="ghost" size="icon-sm" className="size-8 sm:hidden" aria-label="More actions" />}
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" sideOffset={8} className="w-44 p-1">
            <DropdownMenuItem onClick={() => props.onAction({ type: "pin", pinned: true })}>
              <PinIcon />
              Pin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onAction({ type: "pin", pinned: false })}>
              <PinOffIcon />
              Unpin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onAction({ type: "unsettle" })}>
              <Undo2Icon />
              Unsettle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={props.pending}
            render={<Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" />}
          >
            <FolderInputIcon />
            <span className="hidden lg:inline">Move</span>
            <span className="sr-only lg:hidden">Move to group</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" sideOffset={8} className="w-52 p-1">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => props.onAction({ type: "move", groupId: null })}>
                <FolderIcon />
                Ungrouped
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {props.groups.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {props.groups.map((group) => (
                <DropdownMenuItem key={group._id} onClick={() => props.onAction({ type: "move", groupId: group._id })}>
                  <span
                    aria-hidden="true"
                    className={cn("mx-1 size-2 shrink-0 rounded-full", props.groupColors.get(group._id)?.dot)}
                  />
                  <span className="truncate">{group.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />

        <BarButton Icon={Trash2Icon} label="Delete" destructive disabled={props.pending} onClick={props.onDelete} />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Clear selection" onClick={props.onClear} />
            }
          >
            {props.pending ? <Loader2Icon className="animate-spin" /> : <XIcon />}
          </TooltipTrigger>
          <TooltipContent>Clear selection</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

type BarButtonProps = {
  Icon: LucideIcon;
  label: string;
  className?: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function BarButton({ Icon, label, className, destructive, disabled, onClick }: BarButtonProps) {
  return (
    <Button
      variant={destructive ? "destructive" : "ghost"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn("h-8 gap-1.5 px-2", destructive && "bg-transparent dark:bg-transparent", className)}
    >
      <Icon />
      <span className="hidden lg:inline">{label}</span>
      <span className="sr-only lg:hidden">{label}</span>
    </Button>
  );
}
