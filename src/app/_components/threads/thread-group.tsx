import { ThreadItem } from "./thread-items";

import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

import type { Thread } from "@/lib/types";
import { ChevronDownIcon } from "lucide-react";

type ThreadGroupProps = {
  title: string;
  threads: Thread[];
  defaultOpen?: boolean;
};

export function ThreadGroup({ title, threads, defaultOpen = true }: ThreadGroupProps) {
  if (!threads.length) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild className="text-primary px-2 text-sm font-medium">
          <CollapsibleTrigger>
            {title}
            <ChevronDownIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent className="space-y-1">
            {threads.map((thread) => (
              <ThreadItem key={thread._id} thread={thread} />
            ))}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
