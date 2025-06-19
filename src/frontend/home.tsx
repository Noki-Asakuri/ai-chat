import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Navigate } from "react-router";

import { Chat } from "./chat";

import { LoadingPage } from "@/components/loading-page";
import { RegisterHotkeys } from "@/components/register-hotkeys";
import { ThreadGroupButtons } from "@/components/threads/thread-group-buttons";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Home() {
  return (
    <>
      <Authenticated>
        <SidebarProvider className="bg-sidebar">
          <ThreadSidebar />
          <ThreadGroupButtons />

          <Chat />
        </SidebarProvider>

        <RegisterHotkeys />
      </Authenticated>

      <AuthLoading>
        <LoadingPage />
      </AuthLoading>

      <Unauthenticated>
        <Navigate to="/auth/login" />
      </Unauthenticated>
    </>
  );
}
