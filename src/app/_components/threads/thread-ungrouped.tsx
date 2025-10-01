import type { Doc } from "@/convex/_generated/dataModel";

import { Collapsible } from "@base-ui-components/react/collapsible";
import { ChevronLeftIcon } from "lucide-react";

import { SidebarGroup, SidebarGroupLabel } from "../ui/sidebar";

import { ThreadGroupDropzone } from "./thread-group";

export function UngroupedThreadGroup({ threads }: { threads: Doc<"threads">[] }) {
  return (
    <Collapsible.Root
      defaultOpen
      data-group="none"
      data-slot="thread-group-collapsible"
      data-thread-count={threads.length}
    >
      <SidebarGroup className="flex flex-col overflow-hidden rounded-lg">
        <SidebarGroupLabel asChild className="select-none font-semibold">
          <Collapsible.Trigger className="group/trigger flex w-full items-center justify-between gap-2">
            <span>Ungrouped</span>

            <ChevronLeftIcon className="group-data-[panel-open]/trigger:-rotate-90 size-4 transition-[rotate]" />
          </Collapsible.Trigger>
        </SidebarGroupLabel>

        <Collapsible.Panel>
          <ThreadGroupDropzone threads={threads} group={null} />
        </Collapsible.Panel>
      </SidebarGroup>
    </Collapsible.Root>
  );
}
