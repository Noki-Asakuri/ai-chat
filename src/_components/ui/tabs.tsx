import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
      {...props}
    />
  );
}

function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("relative z-0 flex gap-1 rounded-md px-1", className)}
      {...props}
    >
      {children}

      <TabsPrimitive.Indicator className="absolute top-1 left-0 z-[-1] h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) rounded-md bg-muted-foreground/20 transition-all duration-200 ease-in-out" />
    </TabsPrimitive.List>
  );
}

function TabTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "flex h-8 flex-1 items-center justify-center gap-2 border-0 px-2 text-sm font-medium outline-none select-none",
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabTrigger, TabsPanel };
