import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { Button } from "../ui/button";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";

import { cn } from "@/lib/utils";

export function ThreadGroupButtons() {
  const { state, isMobile } = useSidebar();

  return (
    <div
      data-state={isMobile ? "collapsed" : state}
      className={cn(
        "absolute top-3 left-3 z-50 flex items-center justify-center gap-1 rounded-md p-1",
        "group bg-sidebar data-[state=collapsed]:bg-sidebar! md:bg-transparent",
      )}
    >
      <SidebarTrigger />

      <Button
        nativeButton={false}
        render={<Link to="/" />}
        size="icon"
        variant="ghost"
        className="size-7 group-data-[state=expanded]:hidden"
      >
        <PlusIcon />
        <span className="sr-only">New Thread</span>
      </Button>
    </div>
  );
}
