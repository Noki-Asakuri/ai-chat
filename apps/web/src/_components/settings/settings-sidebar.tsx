import { api } from "@ai-chat/backend/convex/_generated/api";

import { useQuery } from "@tanstack/react-query";
import { Link, useLoaderData, useLocation, useSearch } from "@tanstack/react-router";
import { ArrowLeftIcon, LogOutIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getUserAvatarUrl, getUserDisplayName, getUserInitials } from "@/lib/authkit/user";
import { convexSessionQuery } from "@/lib/convex/helpers";
import { getNavigationViewTransition } from "@/lib/navigation/view-transitions";

import { UserUsages } from "./user-usages";

export function SettingsSidebar() {
  const { user } = useLoaderData({ from: "/settings" });

  return (
    <aside className="z-10 flex h-full flex-col gap-4">
      <ReturnToChatButton />

      <UserInfo />
      <UserUsages />
      <KeyboardShortcuts />

      <span className="block w-full text-center text-xs blur-xs transition-[filter] hover:blur-none">
        {user.id}
      </span>

      <SignOutButton />
    </aside>
  );
}

function ReturnToChatButton() {
  const searchParams = useSearch({ from: "/settings" });
  const location = useLocation();
  const to = searchParams.rt ? "/threads/$threadId" : "/";

  return (
    <Button
      variant="secondary"
      nativeButton={false}
      className="mt-1 h-9 w-full"
      render={
        <Link
          to={to}
          params={{ threadId: searchParams.rt }}
          viewTransition={getNavigationViewTransition(location.pathname, searchParams.rt ? `/threads/${searchParams.rt}` : "/")}
        />
      }
    >
      <ArrowLeftIcon />
      Back to Chat
    </Button>
  );
}

function SignOutButton() {
  const location = useLocation();

  return (
    <Button
      variant="destructive"
      className="mt-auto w-full"
      nativeButton={false}
      render={<Link to="/auth/logout" search={{ rt: location.pathname }} />}
    >
      <LogOutIcon />
      Sign out
    </Button>
  );
}

function UserInfo() {
  const { user } = useLoaderData({ from: "/settings" });
  const { data: currentUser } = useQuery(convexSessionQuery(api.functions.users.currentUser));

  const initials = getUserInitials(user);
  const username = getUserDisplayName(user);
  const avatarUrl = currentUser?.imageUrl ?? getUserAvatarUrl(user);

  return (
    <div className="space-y-2">
      <Avatar className="mx-auto size-40">
        <AvatarImage src={avatarUrl} alt={`${username} avatar`} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="text-center">
        <h1 className="text-xl font-semibold capitalize">{username}</h1>
        <p className="text-muted-foreground blur-xs transition-[filter] hover:blur-none">
          {user.email}
        </p>

        <Button variant="ghost" size="sm" className="mt-2 capitalize">
          Free Plan
        </Button>
      </div>
    </div>
  );
}

function KeyboardShortcuts() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Keyboard Shortcuts</CardTitle>
      </CardHeader>

      <CardContent>
        <ul className="space-y-2">
          <li className="flex justify-between">
            <span>Search Threads</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl K</kbd>
          </li>

          <li className="flex justify-between">
            <span>Toggle Sidebar</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl B</kbd>
          </li>

          <li className="flex justify-between">
            <span>New Chat</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl Shift O</kbd>
          </li>

          <li className="flex justify-between">
            <span>Open Model Picker</span>
            <kbd className="rounded-md border bg-muted px-2 py-1 text-xs">Ctrl M</kbd>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
