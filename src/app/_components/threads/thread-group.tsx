import { ThreadItem } from "./thread-items";

import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";

import type { Thread } from "@/lib/types";

export function ThreadGroup({ title, threads }: { title: string; threads: Thread[] }) {
  if (!threads.length) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-primary px-2 text-sm font-medium">
        {title}
      </SidebarGroupLabel>

      <SidebarGroupContent className="space-y-1">
        {threads.map((thread) => (
          <ThreadItem key={thread._id} thread={thread} />
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
