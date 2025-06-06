"use client";

import { UserNavbar } from "@/components/user/navbar";
import { useUser } from "@clerk/nextjs";

export default function Layout({ children }: { children: React.ReactNode }) {
  const user = useUser();

  return (
    <div className="grid">
      <section className="mx-auto grid h-svh w-full max-w-6xl items-center px-4 py-6 sm:justify-center">
        <UserNavbar />
        {children}
      </section>
    </div>
  );
}
