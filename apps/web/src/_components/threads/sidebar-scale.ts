import { cn } from "@/lib/utils";

// Sidebar spacing, icons and controls follow the user's UI font size the way the text does,
// so the layout keeps its proportions at any size instead of clipping or crowding.
const SCALE = "[--sb:var(--custom-ui-font-size,16px)]";

export const ROW_SCALE = cn(
  SCALE,
  "[--row-px:calc(var(--sb)*0.625)] [--row-py:calc(var(--sb)*0.5)] [--row-gap:calc(var(--sb)*0.375)]",
  "[--row-line:calc(var(--sb)*1.25)] [--row-icon:calc(var(--sb)*0.875)] [--row-stack:calc(var(--sb)*0.125)]",
);
export const ROW_ICON = "size-(--row-icon) shrink-0";

export const TOOLBAR_SCALE = cn(SCALE, "[--tb-size:calc(var(--sb)*2)] [--tb-icon:var(--sb)]");
// `!` beats the Button's own `[&_svg:not([class*=size-])]` default.
export const TOOLBAR_BUTTON = "size-(--tb-size) rounded-lg [&_svg]:size-(--tb-icon)!";
