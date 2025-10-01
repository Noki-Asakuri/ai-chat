import { NavLink } from "react-router";

import { ThreadContents } from "./thread-content";
import { ThreadUserProfile } from "./thread-user-profile";

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

export function ThreadSidebar() {
  return (
    <Sidebar
      variant="inset"
      className="bg-sidebar/40 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar"
    >
      <div className="-z-5 pointer-events-none absolute inset-0 group-data-[disable-blur=true]/sidebar-provider:hidden">
        <div className="h-1/2 w-full bg-gradient-to-b from-5% from-sidebar/80 to-80% to-transparent" />
        <div className="h-1/2 w-full bg-gradient-to-t from-5% from-sidebar/80 to-80% to-transparent" />
      </div>

      <SidebarHeader>
        <NavLink to="/" className="text-center text-xl">
          AI Chat
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="flex flex-1 flex-col">
        <ThreadContents />
      </SidebarContent>

      <SidebarFooter>
        <hr className="border-sidebar-accent" />
        <ThreadUserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
