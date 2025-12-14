import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { z } from "zod/v4";

import { SettingsRouteHeader } from "@/components/settings/settings-route-header";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { UserNavbar } from "@/components/user/navbar";

import { getSignInUrl } from "@/lib/authkit/serverFunctions";

export const Route = createFileRoute("/settings")({
  validateSearch: z.object({
    rt: z.union([z.string(), z.number()]).optional(),
  }),
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
    return { user: context.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <main className="custom-scroll mx-auto h-svh w-full flex-1 overflow-y-auto px-6 py-4 lg:overflow-hidden">
      <div className="grid h-full min-h-0 w-full gap-4 lg:grid-cols-[300px_1fr]">
        <SettingsSidebar />

        <div className="flex min-h-0 flex-col">
          <UserNavbar />

          <div className="custom-scroll isolate z-10 min-h-0 w-full flex-1 overflow-visible px-2 pr-3 lg:overflow-y-auto">
            <div className="sticky top-0 z-20 bg-background/80 py-2 backdrop-blur supports-backdrop-filter:bg-background/60">
              <SettingsRouteHeader />
            </div>

            <div className="pt-6">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
