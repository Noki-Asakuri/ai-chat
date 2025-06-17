import { Outlet } from "react-router";

import { UserNavbar } from "@/components/user/navbar";

export function AuthLayout() {
  return (
    <div className="grid">
      <section className="mx-auto grid h-svh w-full max-w-6xl items-center px-4 py-6 sm:justify-center">
        <UserNavbar />
        <Outlet />
      </section>
    </div>
  );
}
