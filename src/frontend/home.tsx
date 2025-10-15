import { api } from "@/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { Chat } from "./chat";

import { RegisterHotkeys } from "@/components/chat/register-hotkeys";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider } from "@/components/ui/sidebar";

import { useChatStore } from "@/lib/chat/store";

export default function Home() {
  const defaultOpenSidebar = document.cookie.includes(`${SIDEBAR_COOKIE_NAME}=true`);
  const cookieBackgroundImage = document.cookie
    .split(";")
    .find((c) => c.includes("background-image="))
    ?.split("=")[1];

  const { data: user } = useQuery({ ...convexQuery(api.functions.users.currentUser, {}) });

  const backgroundImage = useMemo(() => {
    if (user?.customization?.backgroundId)
      return `https://ik.imagekit.io/gmethsnvl/ai-chat/${user.customization.backgroundId}`;

    if (cookieBackgroundImage) return cookieBackgroundImage;

    return undefined;
  }, [cookieBackgroundImage, user?.customization?.backgroundId]);

  useEffect(() => {
    if (user) {
      useChatStore.getState().setUserCustomization(user.customization);

      if (user?.customization?.backgroundId) {
        cookieStore.set({
          path: "/",
          sameSite: "lax",
          name: "background-image",
          value: `https://ik.imagekit.io/gmethsnvl/ai-chat/${user.customization.backgroundId}`,
          expires: Date.now() + 24 * 60 * 60 * 1000,
        });
      }
    }
  }, [user]);

  return (
    <>
      <SidebarProvider
        id="sidebar-provider"
        data-disable-blur={user?.customization?.disableBlur ?? !backgroundImage}
        style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
        className="group/sidebar-provider -z-[9999] bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
        defaultOpen={defaultOpenSidebar}
      >
        <ThreadSidebar />

        <Chat />
      </SidebarProvider>

      <RegisterHotkeys />
    </>
  );
}
