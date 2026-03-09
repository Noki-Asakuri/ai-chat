import "streamdown/styles.css";

import { api } from "@/convex/_generated/api";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { convexQuery } from "@convex-dev/react-query";
import { PlusIcon } from "lucide-react";

import { GlobalDropzone } from "@/components/chat/global-dropzone";
import { RegisterEventHandlers } from "@/components/chat/register-event-handlers";
import { ThreadTitle } from "@/components/chat/top-thread-title";
import { ConfigStoreProvider } from "@/components/provider/config-provider";
import { ThreadProfileSidebar } from "@/components/threads/profile/profile-sidebar";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { buildImageAssetUrl } from "@/lib/assets/urls";
import { getSignInUrl } from "@/lib/authkit/serverFunctions";
import { convexSessionQuery } from "@/lib/convex/helpers";

const getDefaultOpenSidebar = createIsomorphicFn()
  .server(async function () {
    const defaultOpenSidebar = getCookie(SIDEBAR_COOKIE_NAME) === "true";

    return { defaultOpenSidebar };
  })
  .client(async function () {
    const defaultOpenSidebar = await cookieStore.get(SIDEBAR_COOKIE_NAME);

    return { defaultOpenSidebar: defaultOpenSidebar?.value === "true" };
  });

export const Route = createFileRoute("/_chat_layout")({
  component: RouteComponent,

  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: path });

      throw redirect({ href });
    }

    return { user: context.user };
  },

  loader: async ({ context }) => {
    const { defaultOpenSidebar } = await getDefaultOpenSidebar();

    await context.queryClient.prefetchQuery(
      convexQuery(api.functions.users.getCurrentUserPreferences, { sessionId: context.sessionId! }),
    );

    return { user: context.user, defaultOpenSidebar };
  },

  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function RouteComponent() {
  const { defaultOpenSidebar } = Route.useLoaderData();
  const { data: userPreferences } = useSuspenseQuery(
    convexSessionQuery(api.functions.users.getCurrentUserPreferences),
  );

  return (
    <SidebarProvider
      id="sidebar-provider"
      defaultOpen={defaultOpenSidebar}
      data-performance-mode={userPreferences.performanceEnabled ? "true" : "false"}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      style={{
        backgroundImage: userPreferences.backgroundImage
          ? `url(${buildImageAssetUrl(userPreferences.backgroundImage)})`
          : undefined,
      }}
    >
      <ThreadSidebar />

      <GlobalDropzone
        data-slot="chat"
        className="relative inset-0 h-dvh w-screen overflow-hidden border-x"
      >
        <div className="absolute top-0 z-10 flex h-10 w-full max-w-full items-center gap-2 border-b bg-sidebar/80 px-4 text-sm backdrop-blur-md backdrop-saturate-150 group-data-[performance-mode=true]/sidebar-provider:bg-sidebar">
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

        <ConfigStoreProvider
          initialState={{
            hiddenModels: userPreferences.models.hidden,
            favoriteModels: userPreferences.models.favorite,
            defaultShowFullCode: userPreferences.code.showFullCode,
          }}
        >
          <Outlet />
          <ThreadProfileSidebar />
        </ConfigStoreProvider>
      </GlobalDropzone>

      <RegisterEventHandlers />
    </SidebarProvider>
  );
}
