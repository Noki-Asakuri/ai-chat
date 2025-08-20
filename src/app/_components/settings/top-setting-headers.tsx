"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowLeftIcon, LogOutIcon, SunIcon } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function TopSettingHeaders() {
  const auth = useAuth();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Button variant="ghost" asChild>
          <Link href={window.localStorage.getItem("last-thread-ids") ?? "/"}>
            <ArrowLeftIcon />
            Back to Chat
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <SunIcon />
          </Button>

          <Button variant="ghost" onMouseDown={() => auth.signOut()}>
            <LogOutIcon />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
