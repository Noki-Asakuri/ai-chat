import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "../ui/button";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";
import { ThreadCommand } from "./thread-command";

import { cn } from "@/lib/utils";

export function ThreadGroupButtons() {
  const { state } = useSidebar();

  return (
    <div
      className={cn(
        "absolute top-3 left-3 z-50 flex items-center justify-center gap-1 rounded-md p-1",
        { "bg-sidebar": state === "collapsed" },
      )}
    >
      <SidebarTrigger />
      <ThreadCommand sidebarState={state} />

      <Button
        asChild
        size="icon"
        variant="ghost"
        className={cn("size-7", { hidden: state === "expanded" })}
      >
        <Link href="/">
          <PlusIcon />
          <span className="sr-only">New Thread</span>
        </Link>
      </Button>
    </div>
  );
}
