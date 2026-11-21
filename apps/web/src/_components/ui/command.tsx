import {
  Command as CommandPrimitive,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandItemIcon,
  CommandList as CommandListPrimitive,
  CommandPage,
  CommandSeparator as CommandSeparatorPrimitive,
  CommandShortcut as CommandShortcutPrimitive,
  CommandStatus as CommandStatusPrimitive,
  createCommandController,
} from "@ui-sdk/react/command";
import { Dialog, DialogBackdrop, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import { fuzzyScore } from "@ui-sdk/core/text-match";
import { SearchIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

type SearchableItem = { value: string; label: string; keywords?: string[] };

// Keywords weigh a little less than the label, so a label match wins a tie.
function fuzzyItemScore(item: SearchableItem, query: string): number {
  return Math.max(
    fuzzyScore(item.label, query),
    ...(item.keywords ?? []).map((k) => fuzzyScore(k, query) * 0.9),
  );
}

// Composed commands keep the order they're written in, so sort them best match first while searching.
function rankItems<T>(items: readonly T[], query: string, toItem: (item: T) => SearchableItem): T[] {
  const search = query.trim();
  if (!search) return [...items];
  return items
    .map((item, index) => ({ item, index, score: fuzzyItemScore(toItem(item), search) }))
    .toSorted((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

type CommandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
};

function CommandDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  title,
  description,
  className,
  children,
}: CommandDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <DialogBackdrop className="fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <DialogContent
        className={cn(
          "fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-md bg-background p-0 text-xs/relaxed ring-1 ring-foreground/10 outline-none sm:max-w-lg",
          "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<typeof CommandInputPrimitive> & { "aria-label": string; wrapperClassName?: string }) {
  return (
    <div
      data-slot="command-input-wrapper"
      className={cn("flex h-10 shrink-0 items-center gap-2 border-b px-3", wrapperClassName)}
    >
      <SearchIcon aria-hidden="true" className="size-4 shrink-0 opacity-50" />
      <CommandInputPrimitive
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "h-full w-full min-w-0 bg-transparent text-xs outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandListPrimitive>) {
  return (
    <CommandListPrimitive
      tabIndex={-1}
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      className={cn("py-6 text-center text-xs text-muted-foreground not-data-empty:hidden", className)}
      {...props}
    />
  );
}

function CommandStatus({ className, ...props }: React.ComponentProps<typeof CommandStatusPrimitive>) {
  return (
    <CommandStatusPrimitive
      className={cn("py-6 text-center text-xs text-muted-foreground not-data-loading:sr-only", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: Omit<React.ComponentProps<typeof CommandGroupPrimitive>, "children"> & {
  heading?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <CommandGroupPrimitive className={cn("overflow-hidden p-1 text-foreground", className)} {...props}>
      {heading && (
        <CommandGroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </CommandGroupLabel>
      )}
      {children}
    </CommandGroupPrimitive>
  );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandSeparatorPrimitive>) {
  return <CommandSeparatorPrimitive className={cn("-mx-1 h-px bg-border", className)} {...props} />;
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandItemPrimitive>) {
  return (
    <CommandItemPrimitive
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-xs outline-hidden select-none",
        "data-pending:opacity-70 data-disabled:pointer-events-none data-disabled:opacity-50",
        "data-highlighted:bg-muted data-highlighted:text-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<typeof CommandShortcutPrimitive>) {
  return (
    <CommandShortcutPrimitive
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  CommandPage,
  CommandSeparator,
  CommandShortcut,
  CommandStatus,
  createCommandController,
  fuzzyItemScore,
  rankItems,
};
