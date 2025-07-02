import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { Chat } from "./chat";

import { RegisterHotkeys } from "@/components/register-hotkeys";
import { ThreadGroupButtons } from "@/components/threads/thread-group-buttons";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider } from "@/components/ui/sidebar";

export default function Home() {
  const defaultOpenSidebar = document.cookie.includes(`${SIDEBAR_COOKIE_NAME}=true`);

  const user = useQuery(convexQuery(api.users.currentUser, {}));
  const backgroundImage = user?.data?.customization?.backgroundId
    ? `url(https://ik.imagekit.io/gmethsnvl/ai-chat/${user.data.customization.backgroundId})`
    : undefined;

  return (
    <>
      <SidebarProvider
        style={{ backgroundImage }}
        className="bg-sidebar -z-[9999] bg-cover bg-fixed bg-center bg-no-repeat"
        defaultOpen={defaultOpenSidebar}
      >
        <ThreadSidebar />
        <ThreadGroupButtons />

        <Chat />
      </SidebarProvider>

      <RegisterHotkeys />
    </>
  );
}
