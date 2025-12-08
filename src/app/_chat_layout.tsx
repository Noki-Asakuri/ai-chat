import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider } from "@/components/ui/sidebar";

import { getSignInUrl } from "@/lib/authkit/serverFunctions";
import { ChatLoadingPage } from "@/components/chat-loading-page";

const getCookiesServerFunction = createServerFn({ method: "GET" }).handler(async () => {
  const backgroundImage = getCookie("background-image");
  const defaultOpenSidebar = getCookie(SIDEBAR_COOKIE_NAME) === "true";

  return { backgroundImage, defaultOpenSidebar };
});

export const Route = createFileRoute("/_chat_layout")({
  component: RouteComponent,
  pendingComponent: ChatLoadingPage,

  preload: false,
  ssr: "data-only",

  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: path });

      throw redirect({ href });
    }
  },

  loader: async ({ context }) => {
    void context.queryClient.ensureQueryData(convexQuery(api.functions.groups.listGroups));
    const { backgroundImage, defaultOpenSidebar } = await getCookiesServerFunction();

    return { backgroundImage, defaultOpenSidebar, user: context.user! };
  },

  head: ({ loaderData }) => ({
    links: [
      loaderData?.backgroundImage
        ? { rel: "preload", as: "image", href: loaderData.backgroundImage }
        : undefined,
    ],
  }),
});

function RouteComponent() {
  const { backgroundImage, defaultOpenSidebar } = Route.useLoaderData();

  return (
    <SidebarProvider
      id="sidebar-provider"
      style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      defaultOpen={defaultOpenSidebar}
    >
      <ThreadSidebar />
    </SidebarProvider>
  );
}
