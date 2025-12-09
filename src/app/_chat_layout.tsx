import { api } from "@/convex/_generated/api";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { PlusIcon } from "lucide-react";
import { useEffect } from "react";

import { ChatTextarea } from "@/components/chat-textarea/main-textarea";
import { ThreadTitle } from "@/components/chat/chat-history";
import { RegisterHotkeys } from "@/components/chat/register-hotkeys";
import { ThreadProfileSidebar } from "@/components/threads/profile/profile-sidebar";
import { ThreadCommand } from "@/components/threads/thread-command";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { ConfigStoreProvider } from "@/components/provider/config-store-provider";
import { getSignInUrl } from "@/lib/authkit/serverFunctions";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { convexQuery } from "@convex-dev/react-query";

const getCookiesServerFunction = createServerFn({ method: "GET" }).handler(async () => {
  const backgroundImage = getCookie("background-image");
  const defaultOpenSidebar = getCookie(SIDEBAR_COOKIE_NAME) === "true";

  return { backgroundImage, defaultOpenSidebar };
});

export const Route = createFileRoute("/_chat_layout")({
  component: RouteComponent,
  preload: false,

  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: path });

      throw redirect({ href });
    }
  },

  loader: async ({ context }) => {
    const { backgroundImage, defaultOpenSidebar } = await getCookiesServerFunction();

    await context.queryClient.ensureQueryData(
      convexQuery(api.functions.users.currentUser, { sessionId: context.sessionId }),
    );

    return { backgroundImage, defaultOpenSidebar, user: context.user! };
  },

  head: ({ loaderData }) => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
    links: [
      loaderData?.backgroundImage
        ? { rel: "preload", as: "image", href: loaderData.backgroundImage }
        : undefined,
    ],
  }),
});

function RouteComponent() {
  const { backgroundImage, defaultOpenSidebar } = Route.useLoaderData();
  const { data } = useSuspenseQuery(convexSessionQuery(api.functions.users.currentUser));

  const backgroundImageUrl = data?.customization.backgroundId
    ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${data.customization.backgroundId}`
    : backgroundImage;

  useEffect(() => {
    if (data?.customization.backgroundId) {
      const url = `https://ik.imagekit.io/gmethsnvl/ai-chat/${data.customization.backgroundId}`;
      document.cookie = `background-image=${url}; path=/;`;
    } else {
      document.cookie = `background-image=; path=/;`;
    }
  }, [data?.customization.backgroundId]);

  return (
    <SidebarProvider
      id="sidebar-provider"
      style={{ backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined }}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      defaultOpen={defaultOpenSidebar}
    >
      <ThreadSidebar />

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

            <ThreadTitle />
          </div>

          <ThreadCommand />
        </div>

        <ConfigStoreProvider
          initialState={{
            hiddenModels: data?.customization.hiddenModels,
            defaultShowFullCode: data?.customization.showFullCode,
          }}
        >
          <ThreadProfileSidebar />
          <Outlet />

          <ChatTextarea />
        </ConfigStoreProvider>
      </main>

      <RegisterHotkeys />
    </SidebarProvider>
  );
}
