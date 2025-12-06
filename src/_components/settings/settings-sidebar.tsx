import type { User } from "@workos-inc/node";

import { Avatar, AvatarFallback, AvatarImage } from "@/_components/ui/avatar";
import { Button } from "@/_components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";

export function SettingsSidebar({ user }: { user: User }) {
  return (
    <aside className="space-y-4">
      <UserInfo user={user} />
      <KeyboardShortcuts />
    </aside>
  );
}

function UserInfo({ user }: { user: User }) {
  const fallback = [user.lastName, user.firstName]
    .filter(Boolean)
    .map((name) => name![0])
    .join("");

  const username = user.firstName || user.lastName || "Unknown";

  return (
    <div className="space-y-2">
      <Avatar className="mx-auto size-40">
        <AvatarImage src={user.profilePictureUrl as string} alt={`${username} avatar`} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>

      <div className="text-center">
        <h1 className="text-xl font-semibold capitalize">{username}</h1>
        <p className="text-muted-foreground blur-xs hover:blur-none">{user.email}</p>

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
