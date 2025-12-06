"use client";

import { SignOutButton } from "@clerk/nextjs";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function TopSettingHeaders() {
  const searchParams = useSearchParams();
  const threadId = searchParams.get("rt");

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Button variant="ghost" asChild>
          <Link href={threadId ? `/threads/${threadId}` : "/"}>
            <ArrowLeftIcon />
            Back to Chat
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <SignOutButton redirectUrl="/auth/login">
            <Button variant="ghost" className="cursor-pointer">
              <LogOutIcon />
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </header>
  );
}
