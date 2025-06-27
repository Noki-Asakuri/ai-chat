"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui-components/react/tabs";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("relative z-0 flex gap-1 rounded-md border px-1", className)}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator className="bg-muted absolute top-1 left-0 z-[-1] h-[calc(var(--active-tab-height)-4px*2)] w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] rounded-sm transition-all duration-200 ease-in-out" />
    </TabsPrimitive.List>
  );
}

function Tab({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Tab>) {
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

function TabsPanel({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, Tab, TabsPanel };
