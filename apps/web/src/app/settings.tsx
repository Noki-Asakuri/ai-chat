import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import { getAuth } from "@workos/authkit-tanstack-react-start";
import { Suspense } from "react";
import { z } from "zod/v4";

import { SettingsRouteHeader } from "@/components/settings/settings-route-header";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { SettingsTopBar } from "@/components/settings/settings-top-bar";
import { SIDEBAR_COOKIE_NAME, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const getDefaultOpenSidebar = createIsomorphicFn()
  .server(async function () {
    return { defaultOpenSidebar: getCookie(SIDEBAR_COOKIE_NAME) === "true" };
  })
  .client(async function () {
    const defaultOpenSidebar = await cookieStore.get(SIDEBAR_COOKIE_NAME);

    return { defaultOpenSidebar: defaultOpenSidebar?.value === "true" };
  });

export const Route = createFileRoute("/settings")({
  validateSearch: z.object({ rt: z.string().optional() }),

  beforeLoad: async ({ location }) => {
    if (location.pathname === "/settings" || location.pathname === "/settings/") {
      throw redirect({ to: "/settings/general" });
    }

    const auth = await getAuth();
    if (!auth.user) {
      const path = location.pathname;
      throw redirect({ to: "/auth/login", search: { rt: path }, reloadDocument: true });
    }

    return { user: auth.user };
  },
  loader: async ({ context }) => {
    const { defaultOpenSidebar } = await getDefaultOpenSidebar();
    return { user: context.user, defaultOpenSidebar };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { defaultOpenSidebar } = Route.useLoaderData();

  return (
    <SidebarProvider
      id="settings-sidebar-provider"
      defaultOpen={defaultOpenSidebar}
      className="bg-sidebar font-sans"
    >
      <SidebarTrigger size="icon-lg" className="fixed top-1.5 left-3.5 z-60 [&_svg]:size-5!" />
      <SettingsSidebar />

      <main className="relative h-svh min-w-0 flex-1 overflow-hidden border-x bg-background">
        <SettingsTopBar />

        <div data-models-scroll-container className="h-full scrollbar-gutter-both overflow-y-auto pt-12">
          <div
            data-route-transition-scope="settings-content"
            className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 pb-8 sm:px-6 lg:px-8"
          >
            <SettingsRouteHeader />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <Suspense
                fallback={
                  <output className="block py-6 text-sm text-muted-foreground">Loading settings…</output>
                }
              >
                <Outlet />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
