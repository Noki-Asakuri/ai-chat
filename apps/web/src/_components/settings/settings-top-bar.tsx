import { Link, useLocation } from "@tanstack/react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useSidebar } from "@/components/ui/sidebar";

import { cn } from "@/lib/utils";

import { getSettingsNavigationItem } from "./settings-navigation";

export function SettingsTopBar() {
  const { pathname, search } = useLocation();
  const { isMobile, state: sidebarState } = useSidebar();
  const currentPage = getSettingsNavigationItem(pathname);

  if (!currentPage) return null;

  return (
    <header
      className={cn(
        "absolute top-0 z-20 flex h-12 w-full items-center border-b bg-background/80 px-4 backdrop-blur-md backdrop-saturate-150 transition-[padding] duration-200 ease-linear motion-reduce:transition-none",
        (isMobile || sidebarState === "collapsed") && "pl-16",
      )}
    >
      <Breadcrumb>
        <BreadcrumbList className="text-sm">
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/settings/account" search={search} />}>Settings</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentPage.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
