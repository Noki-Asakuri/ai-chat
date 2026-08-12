import { Link, useLoaderData, useLocation, useSearch } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { ThreadUserProfile } from "@/components/threads/thread-user-profile";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { VersionUpdateNotifier } from "@/components/version-update-notifier";

import { getNavigationViewTransition } from "@/lib/navigation/view-transitions";

import { SETTINGS_NAVIGATION } from "./settings-navigation";

export function SettingsSidebar() {
  const { user } = useLoaderData({ from: "/settings" });
  const { pathname, search } = useLocation();
  const searchParams = useSearch({ from: "/settings" });
  const { setOpenMobile } = useSidebar();
  const returnPath = searchParams.rt ? `/threads/${searchParams.rt}` : "/";
  const returnTo = searchParams.rt ? "/threads/$threadId" : "/";

  return (
    <Sidebar variant="inset" className="bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <SidebarHeader className="-mt-2 h-12 shrink-0 justify-center px-4 py-0 pl-20">
        <Link to="/" className="truncate text-xl">
          AI Chat
        </Link>
      </SidebarHeader>

      <SidebarContent className="mt-2 flex flex-1 flex-col px-2 md:px-0">
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {SETTINGS_NAVIGATION.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      className="h-11 gap-3 px-3 text-sm focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground focus-visible:ring-0 [&_svg]:size-5"
                      isActive={pathname === item.path || pathname.startsWith(`${item.path}/`)}
                      render={
                        <Link
                          to={item.path}
                          search={search}
                          viewTransition={getNavigationViewTransition(pathname, item.path)}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto p-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground focus-visible:ring-0"
                  render={
                    <Link
                      to={returnTo}
                      params={{ threadId: searchParams.rt }}
                      viewTransition={getNavigationViewTransition(pathname, returnPath)}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  <ArrowLeftIcon />
                  <span>Back to chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <VersionUpdateNotifier />
        <Separator className="bg-sidebar-accent" />
        <ThreadUserProfile user={user} returnThreadId={searchParams.rt} />
      </SidebarFooter>
    </Sidebar>
  );
}
