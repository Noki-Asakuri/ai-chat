import { useAuth } from "@clerk/react-router";
import { ArrowLeftIcon, LogOutIcon, SunIcon } from "lucide-react";
import { Link, Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { UserNavbar } from "@/components/user/navbar";

import { SettingsSidebar } from "./settings-sidebar";

export function AuthLayout() {
  const { signOut } = useAuth();

  return (
    <div className="flex h-svh w-full flex-col">
      <header>
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeftIcon />
              Back to Chat
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <SunIcon />
            </Button>

            <Button variant="ghost" onMouseDown={() => signOut({ redirectUrl: "/auth/login" })}>
              <LogOutIcon />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto p-4">
        <div className="grid w-full gap-8 md:grid-cols-[300px_1fr]">
          <SettingsSidebar />

          <div>
            <UserNavbar />
            <div className="mt-6 w-full">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
