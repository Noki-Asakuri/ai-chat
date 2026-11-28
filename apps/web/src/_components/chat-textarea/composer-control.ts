/** Borderless pill used by every control in the composer toolbar. */
export const composerControlClassName =
  "h-8 gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[13px] font-normal text-muted-foreground shadow-none transition-colors hover:bg-foreground/6 hover:text-foreground aria-expanded:bg-foreground/6 aria-expanded:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30";

/** Round icon-only variant of {@link composerControlClassName}. */
export const composerIconControlClassName = `${composerControlClassName} size-8 px-0`;

/** The rounded surface both composers (new message and edit) sit on. */
export const composerSurfaceClassName =
  "pointer-events-auto relative mx-auto max-w-4xl overflow-hidden rounded-[22px] border border-foreground/8 bg-popover/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_18px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow] duration-200 focus-within:border-primary/40 focus-within:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_0_0_4px_color-mix(in_oklab,var(--primary)_10%,transparent),0_18px_40px_-12px_rgb(0_0_0/0.6)] motion-reduce:transition-none";
