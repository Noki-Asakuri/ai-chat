import { api } from "@/convex/_generated/api";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { PlusIcon } from "lucide-react";
import { Suspense, useEffect } from "react";

import { GlobalDropzone } from "@/components/chat/global-dropzone";
import { LoadingSkeleton } from "@/components/chat/loading-skeleton";
import { RegisterEventHandlers } from "@/components/chat/register-event-handlers";
import { ThreadTitle } from "@/components/chat/top-thread-title";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { ThreadProfileSidebar } from "@/components/threads/profile/profile-sidebar";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { getSignInUrl } from "@/lib/authkit/serverFunctions";
import { convexSessionQuery } from "@/lib/convex/helpers";

const getCookiesServerFunction = createIsomorphicFn()
  .server(async () => {
    const backgroundImage = getCookie("background-image");
    const defaultOpenSidebar = getCookie(SIDEBAR_COOKIE_NAME) === "true";

    console.log("Server cookies", backgroundImage, defaultOpenSidebar);
    return { backgroundImage, defaultOpenSidebar };
  })
  .client(async () => {
    const backgroundImage = (await cookieStore.get("background-image"))?.value;
    const defaultOpenSidebar = (await cookieStore.get(SIDEBAR_COOKIE_NAME))?.value === "true";

    console.log("Client cookies", backgroundImage, defaultOpenSidebar);
    return { backgroundImage, defaultOpenSidebar };
  });

export const Route = createFileRoute("/_chat_layout")({
  component: RouteComponent,

  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: path });

      throw redirect({ href });
    }
  },

  loader: async ({ context }) => {
    const { backgroundImage, defaultOpenSidebar } = await getCookiesServerFunction();
    return { backgroundImage, defaultOpenSidebar, user: context.user! };
  },

  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RouteComponent() {
  const { backgroundImage, defaultOpenSidebar } = Route.useLoaderData();
  const { data } = useQuery(convexSessionQuery(api.functions.users.currentUser));

  const backgroundImageUrl =
    data?.customization.backgroundId === null
      ? undefined
      : data?.customization.backgroundId
        ? `https://ik.imagekit.io/gmethsnvl/ai-chat/${data.customization.backgroundId}`
        : backgroundImage;

  return (
    <SidebarProvider
      id="sidebar-provider"
      data-disable-blur={data?.customization.disableBlur}
      style={{ backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined }}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      defaultOpen={defaultOpenSidebar}
    >
      <ThreadSidebar />

      <GlobalDropzone
        data-slot="chat"
        className="relative inset-0 h-dvh w-screen overflow-hidden border-x"
      >
        <div className="absolute top-0 z-10 flex h-10 w-full max-w-full items-center gap-2 border-b bg-sidebar/80 px-4 text-sm backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-sidebar">
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

        <Suspense fallback={<LoadingSkeleton />}>
          <ChatComponentPage />
        </Suspense>
      </GlobalDropzone>

      <RegisterEventHandlers />
    </SidebarProvider>
  );
}

function ChatComponentPage() {
  const { data } = useSuspenseQuery(convexSessionQuery(api.functions.users.currentUser));

  useEffect(() => {
    if (data?.customization.backgroundId) {
      const url = `https://ik.imagekit.io/gmethsnvl/ai-chat/${data.customization.backgroundId}`;
      document.cookie = `background-image=${url}; path=/;`;
    } else {
      document.cookie = `background-image=; path=/;`;
    }
  }, [data?.customization.backgroundId]);

  return (
    <ConfigStoreProvider
      initialState={{
        hiddenModels: data?.customization.hiddenModels ?? [],
        defaultShowFullCode: data?.customization.showFullCode,
      }}
    >
      <Outlet />
      <ThreadProfileSidebar />
    </ConfigStoreProvider>
  );
}
