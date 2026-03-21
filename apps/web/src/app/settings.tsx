import { api } from "@ai-chat/backend/convex/_generated/api";

import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { z } from "zod/v4";

import { SettingsRouteHeader } from "@/components/settings/settings-route-header";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { UserNavbar } from "@/components/user/navbar";

export const Route = createFileRoute("/settings")({
  validateSearch: z.object({ rt: z.string().optional() }),
  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      const path = location.pathname;
      const href = await getSignInUrl({ data: path });

      throw redirect({ href });
    }

    if (location.pathname === "/settings" || location.pathname === "/settings/") {
      throw redirect({ to: "/settings/account" });
    }

    return { user: context.user };
  },

  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(convexQuery(api.functions.users.currentUser));
    return { user: context.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <main className="custom-scroll mx-auto h-svh w-full flex-1 overflow-y-auto px-4 py-2 md:px-6 md:py-4 lg:overflow-hidden">
      <div className="grid h-full min-h-0 w-full gap-2 md:gap-4 lg:grid-cols-[300px_1fr]">
        <SettingsSidebar />

        <div className="flex min-h-0 max-w-full min-w-0 flex-col">
          <UserNavbar />

          <div className="custom-scroll isolate z-10 flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col gap-1 overflow-visible pr-3 lg:overflow-y-auto [&>div:not(:first-child)]:pl-1">
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
      </div>
    </main>
  );
}
