import { Link } from "@tanstack/react-router";

import { ThreadContents } from "./thread-content";
import { ThreadUserProfile } from "./thread-user-profile";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

export function ThreadSidebar() {
  return (
    <Sidebar
      variant="inset"
      className="bg-sidebar/40 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar"
    >
      <div className="pointer-events-none absolute inset-0 -z-5 group-data-[disable-blur=true]/sidebar-provider:hidden">
        <div className="h-1/2 w-full bg-linear-to-b from-sidebar/80 from-5% to-transparent to-80%" />
        <div className="h-1/2 w-full bg-linear-to-t from-sidebar/80 from-5% to-transparent to-80%" />
      </div>

      <SidebarHeader className="px-4 py-0">
        <Link to="/" className="text-center text-xl">
          AI Chat
        </Link>
      </SidebarHeader>

      <SidebarContent className="flex flex-1 flex-col px-2 md:px-0">
        <ThreadContents />
      </SidebarContent>

      <SidebarFooter>
        <hr className="border-sidebar-accent" />
        <ThreadUserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
