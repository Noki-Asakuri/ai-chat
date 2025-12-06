import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";

import { Button } from "@/_components/ui/button";

import { signOut } from "@/lib/authkit/serverFunctions";

export function TopSettingHeaders() {
  const searchParams = useSearch({ from: "/settings" });

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Button variant="ghost" asChild>
          <Link
            to={searchParams.rt ? "/threads/$threadId" : "/"}
            params={{ threadId: searchParams.rt }}
          >
            <ArrowLeftIcon />
            Back to Chat
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="cursor-pointer">
            <Link to="/auth/logout">
              <LogOutIcon />
              Sign out
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
