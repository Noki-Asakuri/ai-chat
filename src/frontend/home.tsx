import { Chat } from "./chat";

import { RegisterHotkeys } from "@/components/register-hotkeys";
import { ThreadGroupButtons } from "@/components/threads/thread-group-buttons";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Home() {
  return (
    <>
      <SidebarProvider className="bg-sidebar">
        <ThreadSidebar />
        <ThreadGroupButtons />

        <Chat />
      </SidebarProvider>

      <RegisterHotkeys />
    </>
  );
}
