import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { z } from "zod/v4";

import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { TopSettingHeaders } from "@/components/settings/top-setting-headers";
import { UserNavbar } from "@/components/user/navbar";

import { refreshAccessToken } from "@/components/provider/auth-providers";
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

    const accessToken = await refreshAccessToken({ data: { source: "server" } });
    if (typeof window === "undefined" && accessToken) {
      context.convexClient.serverHttpClient?.setAuth(accessToken);
    }

    return { user: context.user!, accessToken: accessToken };
  },

  loader: async ({ context }) => {
    return { user: context.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useLoaderData();

  return (
    <div className="flex h-svh w-full flex-col">
      <TopSettingHeaders />

      <main className="container mx-auto w-full flex-1 p-4 lg:overflow-hidden">
        <div className="grid h-full w-full grid-rows-[auto_1fr] gap-4 lg:grid-cols-[300px_1fr] lg:grid-rows-1">
          <SettingsSidebar user={user} />

          <div className="flex h-full flex-col overflow-hidden">
            <UserNavbar />

            <div className="custom-scroll mt-6 w-full flex-1 px-2 lg:overflow-y-auto">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
