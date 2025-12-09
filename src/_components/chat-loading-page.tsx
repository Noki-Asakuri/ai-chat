import { Link, Outlet, useLoaderData } from "@tanstack/react-router";

import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";
import { PlusIcon } from "lucide-react";
import { ThreadTitle } from "./chat/chat-render";
import { ThreadCommand } from "./threads/thread-command";
import { ChatTextarea } from "./chat-textarea/main-textarea";

export function ChatLoadingPage() {
  const { backgroundImage, defaultOpenSidebar } = useLoaderData({ from: "/_chat_layout" });

  return (
    <SidebarProvider
      id="sidebar-provider"
      style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      defaultOpen={defaultOpenSidebar}
    >
      <SidebarSkeleton />

      <main data-slot="chat" className="relative inset-0 h-dvh w-screen overflow-hidden">
        <div className="absolute top-0 z-10 flex h-10 w-full items-center justify-between gap-2 border-x border-b bg-sidebar/80 px-4 text-sm backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar">
          <div className="flex items-center gap-2">
            <SidebarTrigger />

            <Link
              to="/"
              className="rounded-md p-1.5 text-center transition-colors hover:bg-primary/20"
            >
              <PlusIcon className="size-4" />
              <span className="sr-only">Create new thread</span>
            </Link>

            <ThreadTitle isSkeleton />
          </div>

          <ThreadCommand isSkeleton />
        </div>

        <Outlet />
        <ChatTextarea />
      </main>
    </SidebarProvider>
  );
}

function SidebarSkeleton() {
  return (
    <Sidebar
      variant="inset"
      className="bg-sidebar/40 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar"
    >
      <div className="pointer-events-none absolute inset-0 -z-5 group-data-[disable-blur=true]/sidebar-provider:hidden">
        <div className="h-1/2 w-full bg-linear-to-b from-sidebar/80 from-5% to-transparent to-80%" />
        <div className="h-1/2 w-full bg-linear-to-t from-sidebar/80 from-5% to-transparent to-80%" />
      </div>

      <SidebarHeader>
        <Link to="/" className="text-center text-xl">
          AI Chat
        </Link>
      </SidebarHeader>

      <SidebarContent className="flex flex-1 flex-col">
        <div className="mt-2 flex items-center gap-2 *:flex-1">
          <Button size="sm" variant="secondary" asChild>
            <Link to="/">New Chat</Link>
          </Button>

          <Button size="sm" variant="secondary" disabled>
            New Group
          </Button>
        </div>

        <hr className="border-sidebar-border" />

        <Skeleton className="h-full w-full" />
      </SidebarContent>

      <SidebarFooter>
        <hr className="border-sidebar-accent" />
        <ThreadUserProfileSkeleton />
      </SidebarFooter>
    </Sidebar>
  );
}

function ThreadUserProfileSkeleton() {
  return (
    <div className="flex gap-2 rounded-md border border-transparent p-2">
      <Skeleton className="size-11 shrink-0 rounded-md" />

      <div className="ml-1 flex h-full w-full flex-col justify-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  );
}
