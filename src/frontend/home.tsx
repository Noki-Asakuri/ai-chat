import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { Chat } from "./chat";

import { RegisterHotkeys } from "@/components/chat/register-hotkeys";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider } from "@/components/ui/sidebar";

import { useChatStore } from "@/lib/chat/store";
import { useEffect } from "react";

export default function Home() {
  const defaultOpenSidebar = document.cookie.includes(`${SIDEBAR_COOKIE_NAME}=true`);

  const { data: user } = useQuery({ ...convexQuery(api.functions.users.currentUser, {}) });
  const backgroundImage = user?.customization?.backgroundId
    ? `url(https://ik.imagekit.io/gmethsnvl/ai-chat/${user.customization.backgroundId})`
    : undefined;

  useEffect(() => {
    if (user) useChatStore.getState().setUserCustomization(user.customization);
  }, [user]);

  return (
    <>
      <SidebarProvider
        id="sidebar-provider"
        data-disable-blur={user?.customization?.disableBlur ?? !backgroundImage}
        style={{ backgroundImage }}
        className="group/sidebar-provider -z-[9999] bg-center bg-cover bg-sidebar bg-fixed bg-no-repeat"
        defaultOpen={defaultOpenSidebar}
      >
        <ThreadSidebar />

        <Chat />
      </SidebarProvider>

      <RegisterHotkeys />
    </>
  );
}
