import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function TopSettingHeaders() {
  const searchParams = useSearch({ from: "/settings" });

  const render = (
    <Link
      to={searchParams.rt ? "/threads/$threadId" : "/"}
      params={{ threadId: searchParams.rt }}
    />
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Button variant="ghost" render={render}>
          <ArrowLeftIcon />
          Back to Chat
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="none"
            render={<Link to="/auth/logout" />}
            className="cursor-pointer border border-destructive/50 bg-destructive/30 hover:bg-destructive/40"
          >
            <LogOutIcon />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
