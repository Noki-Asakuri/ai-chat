import { api } from "@/convex/_generated/api";
import { convexQuery } from "@convex-dev/react-query";

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { ChatLoadingPage } from "@/components/chat-loading-page";
import { RegisterHotkeys } from "@/components/chat/register-hotkeys";
import { ThreadSidebar } from "@/components/threads/thread-sidebar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider } from "@/components/ui/sidebar";

import { getSignInUrl } from "@/lib/authkit/serverFunctions";

const getCookiesServerFunction = createServerFn({ method: "GET" }).handler(async () => {
  const backgroundImage = getCookie("background-image");
  const defaultOpenSidebar = getCookie(SIDEBAR_COOKIE_NAME) === "true";

  return { backgroundImage, defaultOpenSidebar };
});

export const Route = createFileRoute("/_chat_layout")({
  component: RouteComponent,

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
    const { backgroundImage, defaultOpenSidebar } = await getCookiesServerFunction();
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

  return (
    <SidebarProvider
      id="sidebar-provider"
      style={{ backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined }}
      className="group/sidebar-provider -z-9999 bg-sidebar bg-cover bg-fixed bg-center bg-no-repeat"
      defaultOpen={defaultOpenSidebar}
    >
      <ThreadSidebar />
      {/* <Outlet />

      <RegisterHotkeys /> */}
    </SidebarProvider>
  );
}
