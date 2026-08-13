import { api } from "@ai-chat/backend/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { getAuth } from "@workos/authkit-tanstack-react-start";
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

  loader: async ({ context, location }) => {
    if (location.pathname === "/settings" || location.pathname === "/settings/") {
      throw redirect({ to: "/settings/account" });
    }

    const [auth, { defaultOpenSidebar }] = await Promise.all([getAuth(), getDefaultOpenSidebar()]);
    if (!auth.user) {
      const path = location.pathname;
      throw redirect({ to: "/auth/login", search: { rt: path }, reloadDocument: true });
    }

    const needsCurrentUser = location.pathname === "/settings/account";
    const needsPreferences =
      location.pathname === "/settings/appearance" ||
      location.pathname === "/settings/customization" ||
      location.pathname === "/settings/models";

    await Promise.all([
      needsCurrentUser
        ? context.queryClient.ensureQueryData(convexQuery(api.functions.users.currentUser))
        : Promise.resolve(),
      needsPreferences
        ? context.queryClient.ensureQueryData(convexQuery(api.functions.users.getCurrentUserPreferences))
        : Promise.resolve(),
    ]);
    return { user: auth.user, defaultOpenSidebar };
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

        <div data-models-scroll-container className="h-full overflow-y-auto pt-12">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 pb-8 sm:px-6 lg:px-8">
            <SettingsRouteHeader />
            <div
              data-route-transition-scope="settings-content"
              className="flex min-h-0 min-w-0 flex-1 flex-col"
              style={{ viewTransitionName: "settings-content" }}
            >
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}
