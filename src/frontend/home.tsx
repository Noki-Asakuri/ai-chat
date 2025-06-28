import { Chat } from "./chat";

import { RegisterHotkeys } from "@/components/register-hotkeys";
import { ThreadGroupButtons } from "@/components/threads/thread-group-buttons";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider } from "@/components/ui/sidebar";

export default function Home() {
  const defaultOpenSidebar = document.cookie.includes(`${SIDEBAR_COOKIE_NAME}=true`);

  return (
    <>
      <SidebarProvider className="bg-sidebar" defaultOpen={defaultOpenSidebar}>
        <ThreadSidebar />
        <ThreadGroupButtons />

        <Chat />
      </SidebarProvider>

      <RegisterHotkeys />
    </>
  );
}
