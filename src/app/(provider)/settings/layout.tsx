"use client";

import { useConvexAuth } from "convex/react";
import { redirect } from "next/navigation";

import { LoadingPage } from "@/components/loading-page";
import { UserNavbar } from "@/components/user/navbar";

import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { TopSettingHeaders } from "@/components/settings/top-setting-headers";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) return <LoadingPage />;
  if (!isAuthenticated) return redirect("/auth/login");

  return (
    <div className="flex h-svh w-full flex-col">
      <TopSettingHeaders />

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 lg:overflow-hidden">
        <div className="grid h-full w-full grid-rows-[auto_1fr] gap-8 lg:grid-cols-[300px_1fr]">
          <SettingsSidebar />

          <div className="flex h-full flex-col overflow-hidden">
            <UserNavbar />

            <div
              className="custom-scroll mt-6 w-full flex-1 px-2 lg:overflow-y-auto"
              style={{ scrollbarGutter: "stable both-edges" }}
            >
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
